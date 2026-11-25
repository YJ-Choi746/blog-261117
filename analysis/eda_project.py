"""미니프로젝트 EDA: 저장소 커밋 기록 + 운영자 실측을 모아(수집) 정리하고(전처리) 그래프로 봄(시각화).
실행: python3 analysis/eda_project.py  →  docs/screenshots/eda/eda-project.png, analysis/eda-summary.csv
(웹 크롤링은 'AI PM 역할' 글 수집으로 다음 단계에서 진행 예정 — 결과보고서 7장)
"""
import re
import subprocess
from pathlib import Path

import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager

ROOT = Path(__file__).resolve().parent.parent
OUT_PNG = ROOT / "docs/screenshots/eda/eda-project.png"
OUT_CSV = ROOT / "analysis/eda-summary.csv"

# 한글 글꼴 (있는 것 중 첫 번째)
for name in ["Noto Sans CJK KR", "Noto Sans KR", "WenQuanYi Zen Hei", "AppleGothic", "Malgun Gothic"]:
    if any(name in f.name for f in font_manager.fontManager.ttflist):
        plt.rcParams["font.family"] = name
        break
plt.rcParams["axes.unicode_minus"] = False

# 1) 수집: git 커밋 기록 (날짜 · 시각 · 제목)
raw = subprocess.run(["git", "log", "--date=iso-strict", "--format=%ad\t%s"], cwd=ROOT, capture_output=True, text=True, check=True).stdout
rows = [line.split("\t", 1) for line in raw.strip().splitlines() if "\t" in line]
df = pd.DataFrame(rows, columns=["date", "subject"])

# 2) 전처리: 시간대 맞추기(KST), 커밋 종류(feat · fix · docs …) 뽑기, 합치기 커밋 제외
df["date"] = pd.to_datetime(df["date"], utc=True).dt.tz_convert("Asia/Seoul")
df["day"] = df["date"].dt.strftime("%m-%d")
df["type"] = df["subject"].str.extract(r"^(feat|fix|docs|style|test|chore|refactor|prompt|copy|revert)", flags=re.I, expand=False).str.lower().fillna("기타")
df["type"] = df["type"].replace({"copy": "docs", "refactor": "chore", "revert": "fix"})
df = df[~df["subject"].str.startswith("Merge")]
by_day = df.pivot_table(index="day", columns="type", values="subject", aggfunc="count", fill_value=0).sort_index()

# 운영자 실측 (테스트 보고서 3장 ①): 작업 1~4건 메모 → 게시 시간 · 그대로 쓴 문단
works = pd.DataFrame({"작업": ["1", "2", "3", "4"], "게시 시간(분)": [24, 18, 15, 15], "그대로 쓴 문단(%)": [65, 80, 50, 60], "없는 사실(건)": [0, 0, 0, 1]})

# 요약 표 저장
summary = by_day.assign(합계=by_day.sum(axis=1))
summary.to_csv(OUT_CSV, encoding="utf-8-sig")
print(summary.tail(10))
print(works.describe().loc[["mean", "min", "max"]])

# 3) 시각화 (디자인 시스템 색: blue #2F6BEA · black #111111 · gray-600 #5F5F5F · line #E5E5E5)
colors = {"feat": "#2F6BEA", "fix": "#111111", "docs": "#9BB8F5", "style": "#5F5F5F", "test": "#C9C9C9", "chore": "#E5E5E5", "prompt": "#1F4FB8", "기타": "#F2F2F0"}
fig, (a, b) = plt.subplots(1, 2, figsize=(11, 3.6), gridspec_kw={"width_ratios": [1.6, 1]})
bottom = None
for t in [c for c in colors if c in by_day.columns]:
    a.bar(by_day.index, by_day[t], bottom=bottom, label=t, color=colors[t], edgecolor="white", linewidth=0.5)
    bottom = by_day[t] if bottom is None else bottom + by_day[t]
a.set_title(f"날짜 · 종류별 커밋 수 (합계 {len(df)}개, 합치기 제외)", fontsize=11)
a.legend(ncol=4, fontsize=8, frameon=False)
a.spines[["top", "right"]].set_visible(False)
a.tick_params(axis="x", labelrotation=45, labelsize=8)

b.plot(works["작업"], works["게시 시간(분)"], marker="o", color="#2F6BEA", label="게시 시간(분)")
b.axhline(20, color="#5F5F5F", linestyle="--", linewidth=1, label="목표 20분")
for x, y in zip(works["작업"], works["게시 시간(분)"]):
    b.annotate(f"{y}분", (x, y), textcoords="offset points", xytext=(0, 6), ha="center", fontsize=8)
b.set_title("작업별 메모 → 게시 시간 (합계 72분 / 목표 80분)", fontsize=11)
b.set_xlabel("작업 순서"); b.set_ylim(0, 30)
b.legend(fontsize=8, frameon=False)
b.spines[["top", "right"]].set_visible(False)
fig.tight_layout()
OUT_PNG.parent.mkdir(parents=True, exist_ok=True)
fig.savefig(OUT_PNG, dpi=160)
print("saved", OUT_PNG)
