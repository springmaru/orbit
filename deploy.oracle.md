# Oracle Cloud 배포 가이드

`naimed-kepler-bot`을 Oracle Cloud Ubuntu VM에 Docker로 올리는 절차입니다.

## 1. 서버 접속

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

## 3. 코드 가져오기

```bash
git clone <your-repo-url>
cd naimed-kepler-bot
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

## 5. 컨테이너 실행

```bash
docker compose up -d --build
docker compose logs -f bot
```

## 6. 재배포

```bash
git pull
docker compose up -d --build
```

## 7. 데이터 보존

SQLite 파일은 Docker volume `bot_data`에 저장됩니다. `docker compose down -v`를 실행하지 않는 한 유지됩니다.

