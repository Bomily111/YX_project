"""SupportSegmentPlan校验与前闭后开边界规则。"""
from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path


@dataclass(frozen=True)
class SupportSegment:
    start_chainage: float
    end_chainage: float
    support_type: str

    @property
    def length(self) -> float:
        return self.end_chainage - self.start_chainage


def load_segment_plan(
    path: Path,
    available_types: set[str],
    centerline_length: float,
    chainage_offset: float = 0.0,
) -> list[SupportSegment]:
    raw = json.loads(Path(path).read_text(encoding="utf-8"))
    items = raw.get("segments", raw) if isinstance(raw, dict) else raw
    if not isinstance(items, list) or not items:
        raise ValueError("SupportSegmentPlan不能为空。")
    result = [
        SupportSegment(
            float(x["start_chainage"]) - chainage_offset,
            float(x["end_chainage"]) - chainage_offset,
            str(x["support_type"]),
        )
        for x in items
    ]
    for index, segment in enumerate(result):
        if segment.support_type not in available_types:
            raise ValueError(f"未注册的支护类型：{segment.support_type}")
        if segment.end_chainage <= segment.start_chainage:
            raise ValueError("支护区间终点必须大于起点。")
        if segment.end_chainage > centerline_length + 1e-6:
            raise ValueError("支护区间超出centerLine长度。")
        if index and abs(segment.start_chainage - result[index - 1].end_chainage) > 1e-6:
            raise ValueError("SupportSegmentPlan必须连续且不能重叠。")
    return result


def interval_positions(start: float, end: float, spacing: float, offset: float = 0.0) -> list[float]:
    """按前闭后开区间布置离散构件。

    ``offset=0`` 用于钢架、锚杆等从区段起点起排布的构件；钢筋环等需要
    落在一个间距单元中心的构件可传入 ``spacing / 2``。终点始终不计入，
    因此相邻区段不会在同一里程重复生成构件。
    """
    if spacing <= 0:
        raise ValueError("构件纵向间距必须大于0。")
    if offset < 0 or offset >= spacing:
        raise ValueError("布设偏移必须满足 0 <= offset < spacing。")
    first = start + offset
    count = max(0, int((end - first - 1e-9) // spacing) + 1)
    return [first + index * spacing for index in range(count) if first + index * spacing < end - 1e-9]
