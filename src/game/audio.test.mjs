import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUDIO_SAVE_KEY, DEFAULT_AUDIO_SETTINGS, MELODIES, SFX_RECIPES, SFX_NAMES,
  normalizeAudioSettings, midiToFreq, sfxForAction, createAudioEngine,
} from './audio.mjs';

test('音频设置：默认值完整且在合理区间', () => {
  assert.equal(DEFAULT_AUDIO_SETTINGS.musicOn, true);
  assert.equal(DEFAULT_AUDIO_SETTINGS.sfxOn, true);
  assert.ok(DEFAULT_AUDIO_SETTINGS.musicVol > 0 && DEFAULT_AUDIO_SETTINGS.musicVol <= 1);
  assert.ok(DEFAULT_AUDIO_SETTINGS.sfxVol > 0 && DEFAULT_AUDIO_SETTINGS.sfxVol <= 1);
  assert.match(AUDIO_SAVE_KEY, /^otools-princess:/);
});

test('设置规整：接受合法值', () => {
  const s = normalizeAudioSettings({ musicOn: false, sfxOn: true, musicVol: 0.5, sfxVol: 0.8 });
  assert.deepEqual(s, { musicOn: false, sfxOn: true, musicVol: 0.5, sfxVol: 0.8 });
});

test('设置规整：非法输入回退默认值、越界音量被夹取', () => {
  assert.deepEqual(normalizeAudioSettings(null), DEFAULT_AUDIO_SETTINGS);
  assert.deepEqual(normalizeAudioSettings('bad'), DEFAULT_AUDIO_SETTINGS);
  const s = normalizeAudioSettings({ musicVol: 5, sfxVol: -3, musicOn: 'yes' });
  assert.equal(s.musicVol, 1);
  assert.equal(s.sfxVol, 0);
  assert.equal(s.musicOn, true); // 非 boolean 回退默认
});

test('MIDI → 频率换算正确（A4=440Hz）', () => {
  assert.ok(Math.abs(midiToFreq(69) - 440) < 0.001);
  assert.ok(Math.abs(midiToFreq(81) - 880) < 0.001);
  assert.ok(Math.abs(midiToFreq(60) - 261.626) < 0.01);
});

test('BGM 旋律：三首、结构合法、音高与拍数有效', () => {
  assert.ok(MELODIES.length >= 3);
  const ids = new Set();
  for (const mel of MELODIES) {
    assert.ok(mel.id && mel.name, '每首旋律有 id 与名称');
    assert.ok(!ids.has(mel.id), '旋律 id 不重复');
    ids.add(mel.id);
    assert.ok(mel.bpm >= 60 && mel.bpm <= 160, `${mel.id} BPM 合理`);
    assert.ok(mel.notes.length >= 8, `${mel.id} 至少 8 个音符`);
    for (const n of mel.notes) {
      assert.ok(n.m === 0 || (n.m >= 21 && n.m <= 108), `${mel.id} 音高在钢琴范围或休止`);
      assert.ok(n.d > 0 && n.d <= 4, `${mel.id} 拍数合法`);
    }
  }
});

test('音效配方：核心音效齐全、tone 结构合法', () => {
  const required = ['click', 'tab', 'equip', 'unlock', 'star', 'capture', 'spin', 'win', 'scene', 'error'];
  for (const name of required) assert.ok(SFX_RECIPES[name], `存在音效 ${name}`);
  for (const name of SFX_NAMES) {
    const recipe = SFX_RECIPES[name];
    assert.ok(Array.isArray(recipe) && recipe.length > 0, `${name} 配方非空`);
    for (const tone of recipe) {
      assert.ok(typeof tone.at === 'number' && tone.at >= 0, `${name} 起始偏移合法`);
      assert.ok(tone.d > 0 && tone.d < 2, `${name} 时长合法`);
      assert.ok(tone.g > 0 && tone.g <= 1, `${name} 增益合法`);
      if (tone.noise) {
        assert.ok(tone.hp > 0, `${name} 噪声高通合法`);
      } else {
        assert.ok(tone.f > 0, `${name} 频率合法`);
        assert.ok(['sine', 'triangle', 'square'].includes(tone.t), `${name} 波形合法`);
      }
    }
  }
});

test('动作 → 音效语义映射', () => {
  assert.equal(sfxForAction('pickPart'), 'equip');
  assert.equal(sfxForAction('doCapture'), 'capture');
  assert.equal(sfxForAction('unknown'), 'click');
});

test('无浏览器环境下引擎安全空转（可 import、方法不抛错）', () => {
  const engine = createAudioEngine();
  assert.doesNotThrow(() => {
    engine.unlock();
    engine.play('click');
    engine.startMusic();
    engine.applySettings({ musicOn: false, sfxOn: false, musicVol: 0.2, sfxVol: 0.2 });
    engine.stopMusic();
    engine.dispose();
  });
  assert.equal(engine.settings.musicOn, false);
});
