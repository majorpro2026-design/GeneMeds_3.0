from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv
from sqlalchemy import create_engine


@dataclass(frozen=True)
class DatabaseConfig:
	host: str
	port: int
	name: str
	user: str
	password: str
	sslmode: str = "require"

	@property
	def sqlalchemy_url(self) -> str:
		return (
			f"postgresql+psycopg://{self.user}:{self.password}"
			f"@{self.host}:{self.port}/{self.name}?sslmode={self.sslmode}"
		)


def load_config() -> DatabaseConfig:
	load_dotenv()

	return DatabaseConfig(
		host=os.getenv("DB_HOST", ""),
		port=int(os.getenv("DB_PORT", "5432")),
		name=os.getenv("DB_NAME", ""),
		user=os.getenv("DB_USER", ""),
		password=os.getenv("DB_PASSWORD", ""),
		sslmode=os.getenv("DB_SSLMODE", "require"),
	)


def validate_config(config: DatabaseConfig) -> None:
	missing = [
		key
		for key, value in {
			"DB_HOST": config.host,
			"DB_NAME": config.name,
			"DB_USER": config.user,
			"DB_PASSWORD": config.password,
		}.items()
		if not value
	]
	if missing:
		raise ValueError(f"Missing required environment variables: {', '.join(missing)}")


config = load_config()
validate_config(config)
engine = create_engine(config.sqlalchemy_url, pool_pre_ping=True)