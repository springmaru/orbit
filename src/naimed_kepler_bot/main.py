from __future__ import annotations

import logging

from naimed_kepler_bot.bot import NaimedKeplerBot
from naimed_kepler_bot.config import load_settings


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    settings = load_settings()
    bot = NaimedKeplerBot(settings)
    bot.run(settings.discord_bot_token)


if __name__ == "__main__":
    main()

