from bigeastBot import getStaticText, sortStandings, getGameIDs, data_path


def test_static_text_contains_subreddit():
    text = getStaticText()
    assert "/r/bigeast" in text.lower()


def test_data_path():
    import os
    result = data_path("standings.csv")
    assert result.endswith("standings.csv")
    assert os.sep in result or "/" in result
