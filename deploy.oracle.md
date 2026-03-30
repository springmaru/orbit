# Oracle Cloud 배포 가이드

`naimed-kepler-bot`을 Oracle Cloud Ubuntu VM에 Docker로 올리는 가장 단순한 절차입니다.

## 1. Oracle Cloud VM 준비

- Ubuntu VM 생성
- 공인 IP 확인
- SSH 키로 접속 가능하게 설정

SSH 예시:

```bash
ssh ubuntu@YOUR_SERVER_IP
```

## 2. Docker 설치

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker
```

확인:

```bash
docker --version
docker compose version
```

## 3. 서버에 프로젝트 업로드

방법은 둘 중 하나면 충분합니다.

### Git으로 가져오기

```bash
git clone <your-repo-url>
cd <repo>/naimed-kepler-bot
```

### 로컬에서 서버로 복사

```bash
scp -r /Users/maru/adiavic/naimed-kepler-bot ubuntu@YOUR_SERVER_IP:~/
ssh ubuntu@YOUR_SERVER_IP
cd ~/naimed-kepler-bot
```

## 4. 환경 변수 설정

```bash
cp .env.example .env
nano .env
```

예시:

```env
DISCORD_BOT_TOKEN=your-real-bot-token
DISCORD_GUILD_ID=123456789012345678
BOT_ADMIN_ROLE_IDS=111111111111111111,222222222222222222
DATABASE_PATH=data/kepler_bot.db
```

## 5. Docker로 실행

```bash
docker compose up -d --build
```

로그 확인:

```bash
docker compose logs -f
```

정상 실행 후에는 Discord 서버에서 slash command를 확인합니다.

## 6. 재배포

코드 수정 후:

```bash
docker compose up -d --build
```

## 7. 운영 기본 명령어

상태 확인:

```bash
docker compose ps
```

로그 보기:

```bash
docker compose logs -f bot
```

재시작:

```bash
docker compose restart bot
```

중지:

```bash
docker compose down
```

## 8. 데이터 보존

SQLite 파일은 Docker named volume `bot_data`에 저장됩니다.

컨테이너를 다시 만들어도 데이터는 유지됩니다. 다만 `docker compose down -v`를 실행하면 볼륨까지 삭제되므로 주의하세요.

## 9. 추천 운영 메모

- Discord bot token은 절대 Git에 커밋하지 않기
- Oracle VM 방화벽은 Discord 봇 특성상 인바운드 포트가 필수는 아님
- 추후 백업이 중요해지면 SQLite 대신 PostgreSQL로 이전 고려
- 운영 초기에 `agenda`와 `reward` 로그를 주기적으로 백업 권장

