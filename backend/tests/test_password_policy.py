import pytest

from app.auth.user_schemas import validate_password_strength


@pytest.mark.parametrize("pw", ["Doctor@123", "abc12345!", "A1!aaaaa"])
def test_valid_passwords(pw):
    assert validate_password_strength(pw) == pw


@pytest.mark.parametrize(
    "pw",
    ["short1!", "NoDigits!!", "12345678!", "NoSymbol123", "Pass word1", "x" * 129 + "1!"],
)
def test_invalid_passwords(pw):
    with pytest.raises(ValueError):
        validate_password_strength(pw)