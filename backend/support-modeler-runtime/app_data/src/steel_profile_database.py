"""共享工字钢截面数据库的严格读取与建模校验。"""

from __future__ import annotations

import json
import math
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATABASE = ROOT / "database" / "steel_profiles.json"
REQUIRED_FIELDS = ("height", "width", "web_thickness", "flange_thickness")


class SteelProfileValidationError(ValueError):
    """型钢型号不存在或截面字段不完整。"""

    def __init__(self, code: str, message: str, *, profile: str | None = None, missing_fields: list[str] | None = None):
        super().__init__(message)
        self.code = code
        self.profile = profile
        self.missing_fields = missing_fields or []

    def as_dict(self) -> dict:
        return {
            "error_code": self.code,
            "message": str(self),
            "profile": self.profile,
            "missing_fields": self.missing_fields,
        }


def load_steel_profiles(path: Path = DEFAULT_DATABASE) -> dict[str, dict[str, float]]:
    """读取共享 JSON；数据库整体格式错误时直接失败。"""
    payload = json.loads(Path(path).read_text(encoding="utf-8-sig"))
    if not isinstance(payload, dict):
        raise SteelProfileValidationError("STEEL_PROFILE_DATABASE_INVALID", "型钢数据库根节点必须是对象。")
    return payload


def require_steel_profile(profile: str | None, path: Path = DEFAULT_DATABASE) -> dict[str, float]:
    """返回完整且为正数的截面；禁止未知型号 fallback。"""
    key = str(profile or "").strip()
    if not key:
        raise SteelProfileValidationError(
            "STEEL_PROFILE_INCOMPLETE", "steel_profile 为空。", profile=key, missing_fields=["steel_profile"]
        )
    profiles = load_steel_profiles(path)
    if key not in profiles:
        raise SteelProfileValidationError(
            "UNSUPPORTED_STEEL_PROFILE", f"型钢数据库不支持 {key}。", profile=key
        )
    raw = profiles[key]
    missing = [name for name in REQUIRED_FIELDS if name not in raw or raw[name] is None]
    invalid = [
        name for name in REQUIRED_FIELDS
        if name in raw and raw[name] is not None
        and (isinstance(raw[name], bool) or not isinstance(raw[name], (int, float))
             or not math.isfinite(float(raw[name])) or float(raw[name]) <= 0)
    ]
    missing.extend(name for name in invalid if name not in missing)
    if missing:
        raise SteelProfileValidationError(
            "STEEL_PROFILE_INCOMPLETE",
            f"{key} 型钢截面字段缺失或无效：{', '.join(missing)}。",
            profile=key,
            missing_fields=missing,
        )
    return {name: float(raw[name]) for name in REQUIRED_FIELDS}

