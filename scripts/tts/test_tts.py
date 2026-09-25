"""python3 -m unittest discover -s scripts/tts"""
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest import mock

import tts


class TextRules(unittest.TestCase):
    def test_strip_diacritics_only_touches_latin(self):
        self.assertEqual(tts.strip_diacritics("pōtiō thēsauros"), "potio thesauros")
        self.assertEqual(tts.strip_diacritics("きびきび・すべて「（毒）」"), "きびきび・すべて「（毒）」")

    def test_ja_for_speech(self):
        self.assertEqual(tts.ja_for_speech("（薬・魔法の）飲み薬"), "薬、魔法の 飲み薬")
        self.assertEqual(tts.ja_for_speech("「少年」→「騎士」"), "「少年」、「騎士」")

    def test_syn_key_matches_app(self):
        # app/app.js の synKey と同じ規則
        self.assertEqual(tts.syn_key("Alter Ego"), "syn.alter-ego")
        self.assertEqual(tts.syn_key("call forth"), "syn.call-forth")

    def test_hash_ignores_output_settings(self):
        v = {"version": "1", "backend": "command", "command": ["x"], "formats": ["webm"], "jobs": 1}
        w = {**v, "formats": ["webm", "m4a"], "jobs": 8}
        self.assertEqual(tts.audio_hash(v, "en", "potion"), tts.audio_hash(w, "en", "potion"))
        self.assertNotEqual(tts.audio_hash(v, "en", "potion"), tts.audio_hash({**v, "version": "2"}, "en", "potion"))

    def test_every_word_has_core_clips(self):
        items = tts.build_utterances()
        for key in ("potion.word", "potion.meaning", "potion.katakana", "potion.example.en", "potion.example.ja", "syn.elixir"):
            self.assertEqual(items[key]["tier"], "core")
        self.assertEqual(items["potion.story"]["tier"], "extended")


class FakeQwen:
    """qwen_tts.Qwen3TTSModel の代わり。呼ばれ方だけを記録する。"""
    calls = []

    @classmethod
    def from_pretrained(cls, name, **_kwargs):
        cls.calls.append(("load", name))
        return cls()

    def generate_voice_design(self, text, language, instruct):
        self.calls.append(("design", text, language, instruct))
        return [[0.0]], 24000

    def create_voice_clone_prompt(self, ref_audio, ref_text):
        self.calls.append(("prompt", ref_audio, ref_text))
        return "PROMPT"

    def generate_voice_clone(self, text, language, voice_clone_prompt):
        self.calls.append(("clone", text, language, voice_clone_prompt))
        return [[0.0]], 24000


class Qwen3Design(unittest.TestCase):
    def setUp(self):
        FakeQwen.calls = []
        self.tmp = tempfile.TemporaryDirectory()
        written = []
        fakes = {
            "torch": types.SimpleNamespace(bfloat16="bf16", float32="fp32", manual_seed=lambda s: FakeQwen.calls.append(("seed", s))),
            "soundfile": types.SimpleNamespace(write=lambda path, _wav, _sr: (written.append(path), Path(path).write_bytes(b""))),
            "qwen_tts": types.SimpleNamespace(Qwen3TTSModel=FakeQwen),
        }
        self.written = written
        self.voice = {
            "name": "navi",
            "lang_map": {"ja": "Japanese", "en": "English"},
            "qwen3": {"model": "base", "ref_audio": "tts/voices/navi.ref.wav", "ref_text": "こんにちは",
                      "design": {"model": "design", "instruct": "anime voice actress"}},
        }
        for patcher in (mock.patch.dict(sys.modules, fakes), mock.patch.dict(tts._QWEN, clear=True),
                        mock.patch.dict(tts._QWEN_PROMPT, clear=True), mock.patch.object(tts, "TTS_DIR", Path(self.tmp.name)),
                        mock.patch.object(tts, "ROOT", Path(self.tmp.name)), mock.patch.object(tts, "load_voice", lambda _n: self.voice)):
            patcher.start()
            self.addCleanup(patcher.stop)
        self.addCleanup(self.tmp.cleanup)

    def test_design_makes_candidates_with_ref_text(self):
        tts.cmd_design(types.SimpleNamespace(voice="navi", count=2, seed=5))
        self.assertIn(("design", "こんにちは", "Japanese", "anime voice actress"), FakeQwen.calls)
        self.assertEqual([Path(p).name for p in self.written], ["seed5.wav", "seed6.wav"])
        self.assertTrue((Path(self.tmp.name) / "design" / "navi" / "index.html").exists())

    def test_dtype_is_configurable(self):
        seen = []
        with mock.patch.object(FakeQwen, "from_pretrained", classmethod(lambda cls, name, **kw: seen.append(kw) or cls())):
            tts.qwen3_model("m1", {"device": "cpu", "dtype": "float32"})
            tts.qwen3_model("m2", {})
        self.assertEqual(seen, [{"device_map": "cpu", "dtype": "fp32"}, {"device_map": "cuda:0", "dtype": "bf16"}])

    def test_synth_reuses_clone_prompt(self):
        for text in ("potion", "ポーション"):
            tts.synth_qwen3(self.voice, "en", text, Path(self.tmp.name) / f"{text}.wav")
        prompts = [c for c in FakeQwen.calls if c[0] == "prompt"]
        self.assertEqual(prompts, [("prompt", str(Path(self.tmp.name) / "tts/voices/navi.ref.wav"), "こんにちは")])
        self.assertEqual([c for c in FakeQwen.calls if c[0] == "load"], [("load", "base")])
        self.assertIn(("clone", "potion", "English", "PROMPT"), FakeQwen.calls)


if __name__ == "__main__":
    unittest.main()
