"""python3 -m unittest discover -s scripts/tts"""
import unittest

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


if __name__ == "__main__":
    unittest.main()
