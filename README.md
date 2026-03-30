# Naimed Kepler Bot

사내 Discord 서버에서 사용하는 내부 사원 관리용 봇입니다.

현재 1차 목표:

- Employee Management: 사원 등록, 상태 관리, KP 현황 조회
- KP Reward System: 기여도 기반 soulbound 포인트 관리
- Governance: 안건 생성, KP 기반 투표, 결과 집계

## 기술 선택

- Python 3.11+
- `discord.py`
- SQLite

초기 버전은 빠르게 시작할 수 있도록 SQLite 기반으로 구성했습니다. 운영하면서 필요해지면 MySQL/PostgreSQL 또는 기존 `naimed-kepler-api`와의 연동 구조로 확장할 수 있습니다.

## 프로젝트 구조

```text
naimed-kepler-bot/
├── src/naimed_kepler_bot/
│   ├── cogs/
│   │   ├── employee.py
│   │   ├── governance.py
│   │   ├── performance.py
│   │   └── reward.py
│   ├── services/
│   │   ├── employee_service.py
│   │   ├── governance_service.py
│   │   ├── performance_service.py
│   │   ├── reward_service.py
│   │   └── storage.py
│   ├── bot.py
│   ├── config.py
│   └── main.py
├── .env.example
├── pyproject.toml
└── README.md
```

## 빠른 시작

```bash
cd /Users/maru/adiavic/naimed-kepler-bot
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
cp .env.example .env
python -m naimed_kepler_bot.main
```

## Docker 실행

```bash
cd /Users/maru/adiavic/naimed-kepler-bot
cp .env.example .env
docker compose up -d --build
docker compose logs -f bot
```

Oracle Cloud 배포 절차는 [deploy.oracle.md](/Users/maru/adiavic/naimed-kepler-bot/deploy.oracle.md) 참고

## Discord 설정

`.env`에서 아래 값을 설정하세요.

- `DISCORD_BOT_TOKEN`: Discord bot token
- `DISCORD_GUILD_ID`: slash command를 동기화할 서버 ID
- `BOT_ADMIN_ROLE_IDS`: 포인트 지급/평가 기록 권한이 있는 역할 ID 목록
- `DATABASE_PATH`: SQLite 파일 경로

## 제공 명령어

## KP 정책 메모

- KP는 `Kepler Points`이며 나이메드 프로젝트 기여도를 측정하는 내부 포인트입니다.
- KP는 `soulbound` 개념으로 취급하며 양도나 판매를 지원하지 않습니다.
- 이후 금전적 기여도와 함께 지분 구조 참고 자료로 활용할 수 있는 내부 지표를 목표로 합니다.
- 현재 봇은 온체인 구현이 아니라, Discord 내 운영 자동화를 위한 오프체인 관리 도구입니다.

## 제공 명령어

### Employee

- `/employee_register @user [legal_name] [department] [role_title]`
- `/employee_status @user status`
- `/employee_profile @user`
- `/employee_list`

### KP Reward

- `/reward_give @user points reason`
- `/reward_balance [user]`
- `/reward_leaderboard`

### Governance

- `/agenda_create title description grade deadline`
- `/agenda_vote agenda_id choice`
- `/agenda_result agenda_id`
- `/agenda_list`
- `/agenda_close agenda_id`

### Performance

- `/performance_check @user score summary`
- `/performance_history @user`

## 현재 설계 원칙

- 관리자 역할만 사원 등록, KP 지급, 안건 생성/마감 가능
- KP는 사용자 간 이전 기능을 제공하지 않음
- 투표는 각 사용자의 현재 KP를 스냅샷으로 저장해 집계
- Grade 1~3 안건 분류를 지원
- SQLite에 이력 저장
- 서비스 레이어를 분리해 추후 API/DB 교체를 쉽게 유지

## KP 예시 항목

- 매일 출석 체크: `1 KP`
- 공지사항 체크: `5 KP`
- 회의 참석: `35 KP`
- 교육 관련 리서치 작성 및 컨펌: `150 KP`
- Pull Request: `75 KP`
- 인스타그램 릴스 제작 참여: `50 KP`

현재 봇은 정해진 카탈로그를 강제하지 않고, 운영자가 `reason`과 `points`를 직접 입력하는 방식으로 시작합니다.

## 거버넌스 Grade 예시

- Grade 1: 작은 단위 의사결정, 앱 수정사항 수용 여부 등
- Grade 2: 인적자원 관리 등 중간 수준 안건
- Grade 3: 투자, 사무실 계약, 주요 자본/리스크 관리 안건

## 다음 단계 추천

1. Discord 서버 역할 정책 확정
2. 출석 체크와 공지사항 확인 자동 명령 추가
3. KP 획득 사유 카테고리 표준화
4. Agenda deadline 자동 마감 스케줄러 추가
5. 거버넌스 의결 정족수와 가중치 규칙 확정
