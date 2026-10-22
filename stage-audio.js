// 음악은 서서히 시작/종료하고, 문 효과음은 화면과 공유한 시각에 예약합니다.
class StageAudio {
  constructor(player, tracks, urls, status) {
    this.player = player;
    this.tracks = tracks;
    this.urls = urls;
    this.status = status;
    this.masterVolume = .75;
    this.trackVolumes = Object.fromEntries(Object.entries(tracks).map(([key, track]) => [key, track.volume ?? 1]));
    this.fadeOutMs = STAGE_SHOW.musicFadeOutMs;
    this.fadeDeadline = 0;
    this.envelopeState = {from:1, to:1, start:0, end:0};
    this.operation = 0;
    this.doorOperation = 0;
    this.activeTrack = null;
    this.player.preload = 'auto';
    this.player.onended = () => {
      if (!this.activeTrack) return;
      this.activeTrack = null;
      this.fadeDeadline = 0;
      this.status('음악 재생 완료');
    };
    this.player.ontimeupdate = () => {
      const left = this.player.duration - this.player.currentTime;
      if (this.activeTrack && !this.player.loop && !this.naturalFade && !this.fadeDeadline && left > 0 && left <= this.fadeOutMs / 1000) {
        this.naturalFade = true;
        this.fadeDeadline = this.ctx.currentTime + left;
        this.ramp(0, left);
      }
    };
  }

  context() {
    if (this.ctx) return this.ctx;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) throw new Error('이 브라우저는 음향 동기화를 지원하지 않습니다.');
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.masterVolume;
    this.master.connect(this.ctx.destination);
    this.musicLevel = this.ctx.createGain();
    this.musicLevel.connect(this.master);
    this.doorLevel = this.ctx.createGain();
    this.doorLevel.gain.value = this.trackVolumes.door;
    this.doorLevel.connect(this.master);
    this.envelope = this.ctx.createGain();
    this.envelope.connect(this.musicLevel);
    this.ctx.createMediaElementSource(this.player).connect(this.envelope);
    return this.ctx;
  }

  unlock() {
    const ctx = this.context();
    return ctx.state === 'running' ? Promise.resolve() : ctx.resume();
  }

  setVolume(value) {
    this.masterVolume = value;
    if (this.master) this.master.gain.setValueAtTime(value, this.ctx.currentTime);
  }

  setTrackVolume(key, value) {
    if (!Object.hasOwn(this.tracks, key) || !Number.isFinite(Number(value))) return;
    const volume = Math.max(0, Math.min(1, Number(value)));
    this.trackVolumes[key] = volume;
    if (this.ctx && key === 'door') this.doorLevel.gain.setValueAtTime(volume, this.ctx.currentTime);
    else if (this.ctx && key === this.activeTrack) this.musicLevel.gain.setValueAtTime(volume, this.ctx.currentTime);
  }

  setFadeOut(milliseconds) {
    this.fadeOutMs = Math.max(500, Math.min(8000, Number(milliseconds) || STAGE_SHOW.musicFadeOutMs));
  }

  envelopeValueAt(time = this.ctx.currentTime) {
    const state = this.envelopeState;
    if (time <= state.start) return state.from;
    if (time >= state.end || state.end <= state.start) return state.to;
    return state.from + (state.to - state.from) * (time - state.start) / (state.end - state.start);
  }

  setEnvelope(value) {
    if (!this.envelope) return;
    const now = this.ctx.currentTime;
    const gain = this.envelope.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(value, now);
    this.envelopeState = {from:value, to:value, start:now, end:now};
  }

  ramp(value, seconds) {
    if (!this.envelope) return;
    const now = this.ctx.currentTime;
    const gain = this.envelope.gain;
    const current = this.envelopeValueAt(now);
    // 이전 램프가 끝난 뒤에도 반드시 '지금의 음량'을 새 시작점으로 고정합니다.
    // 시작점 없이 종료만 예약하면 과거 이벤트부터 계산되어 첫 순간 음량이 뛰어내립니다.
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(current, now);
    gain.linearRampToValueAtTime(value, now + seconds);
    this.envelopeState = {from:current, to:value, start:now, end:now+seconds};
  }

  async stopMusic(fadeMs = this.fadeOutMs) {
    const operation = ++this.operation;
    if (!this.player.paused && fadeMs > 0) {
      const remaining = (this.fadeDeadline - this.ctx.currentTime) * 1000;
      if (remaining > 0) fadeMs = Math.min(fadeMs, remaining);
      this.fadeDeadline = this.ctx.currentTime + fadeMs / 1000;
      this.ramp(0, fadeMs / 1000);
      await new Promise(resolve => setTimeout(resolve, fadeMs));
    }
    if (operation !== this.operation) return false;
    this.player.pause();
    this.player.currentTime = 0;
    this.activeTrack = null;
    this.fadeDeadline = 0;
    return true;
  }

  async play(key) {
    if (key === 'door') return this.previewDoor();
    const operation = ++this.operation;
    this.stopDoor();
    if (!this.urls[key]) { this.status(`${this.tracks[key].label} 파일을 먼저 선택해 주세요.`); return; }
    try {
      await this.unlock();
      if (operation !== this.operation) return;
      if (!this.player.paused) {
        const remaining = (this.fadeDeadline - this.ctx.currentTime) * 1000;
        const fadeMs = remaining > 0 ? remaining : this.fadeOutMs;
        this.fadeDeadline = this.ctx.currentTime + fadeMs / 1000;
        this.ramp(0, fadeMs / 1000);
        await new Promise(resolve => setTimeout(resolve, fadeMs));
        if (operation !== this.operation) return;
      }
      this.player.pause();
      this.fadeDeadline = 0;
      this.player.src = this.urls[key];
      this.player.loop = this.tracks[key].loop;
      this.player.currentTime = 0;
      this.naturalFade = false;
      this.activeTrack = key;
      this.musicLevel.gain.setValueAtTime(this.trackVolumes[key], this.ctx.currentTime);
      this.setEnvelope(0);
      await this.player.play();
      if (operation !== this.operation) return;
      this.ramp(1, STAGE_SHOW.musicFadeMs / 1000);
      this.status(`재생 중 · ${this.tracks[key].label}`);
    } catch {
      if (operation === this.operation) {
        this.activeTrack = null;
        this.status('음향을 시작할 수 없습니다. 해당 곡의 재생 버튼을 눌러 주세요.');
      }
    }
  }

  stopDoor() {
    ++this.doorOperation;
    if (this.doorSource) {
      this.doorSource.onended = null;
      try { this.doorSource.stop(); } catch {}
      this.doorSource.disconnect();
      this.doorSource = null;
    }
  }

  async stop() {
    this.stopDoor();
    this.status(`음향을 서서히 종료하는 중 · ${(this.fadeOutMs / 1000).toFixed(1)}초`);
    if (await this.stopMusic()) this.status('음향 정지');
  }

  async pause() {
    const doorWasActive = !!this.doorSource;
    this.stopDoor();
    if (doorWasActive) { this.status('문 효과음 정지'); return; }
    if (!this.activeTrack) return;
    const operation = ++this.operation;
    if (this.player.paused) {
      try { await this.unlock(); if(operation!==this.operation)return; this.naturalFade = false; this.fadeDeadline = 0; await this.player.play(); if(operation!==this.operation)return; this.ramp(1, .3); this.status('음악 재생'); }
      catch { this.status('해당 곡의 재생 버튼을 눌러 주세요.'); }
    } else {
      this.player.pause();
      this.status('음악 일시정지');
    }
  }

  prepareDoor() {
    const url = this.urls.door;
    if (this.doorUrl === url && this.doorBufferPromise) return this.doorBufferPromise;
    this.doorUrl = url;
    this.doorBufferPromise = fetch(url).then(response => {
      if (!response.ok) throw new Error('효과음을 불러오지 못했습니다.');
      return response.arrayBuffer();
    }).then(data => this.context().decodeAudioData(data));
    this.doorBufferPromise.catch(() => { if (this.doorUrl === url) this.doorBufferPromise = null; });
    return this.doorBufferPromise;
  }

  async scheduleDoor(onReady) {
    this.stopDoor();
    const operation = this.doorOperation;
    const [, buffer] = await Promise.all([this.unlock(), this.prepareDoor()]);
    if (operation !== this.doorOperation) return;
    if (this.ctx.state !== 'running') throw new Error('음향 준비 버튼을 눌러 주세요.');
    const startAt = Date.now() + STAGE_SHOW.gateLeadMs;
    const start = this.ctx.currentTime + STAGE_SHOW.gateLeadMs / 1000;
    const duration = STAGE_SHOW.gateMs / 1000;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    // 다른 파일로 바꿔도 문 동작의 4초에 맞추어 재생합니다.
    source.playbackRate.value = buffer.duration < duration ? buffer.duration / duration : 1;
    const envelope = this.ctx.createGain();
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(1, start + .04);
    envelope.gain.setValueAtTime(1, start + duration - .18);
    envelope.gain.linearRampToValueAtTime(0, start + duration);
    source.connect(envelope).connect(this.doorLevel);
    source.onended = () => {
      if (this.doorSource === source) {
        this.doorSource = null;
        this.status('문 열림 · 효과음 종료');
      }
      source.disconnect();
      envelope.disconnect();
    };
    this.doorSource = source;
    source.start(start);
    source.stop(start + duration);
    onReady(startAt);
    this.status('문 열림 · 효과음 4초 동기 재생');
  }

  async previewDoor() {
    this.stopMusic(100);
    try { await this.scheduleDoor(() => {}); }
    catch { this.status('효과음을 재생할 수 없습니다. 다시 눌러 주세요.'); }
  }
}
