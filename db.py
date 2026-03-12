"""
Azure Cosmos DB (NoSQL / Core API) repository.
Uses the azure-cosmos SDK with a single shared client instance.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from azure.cosmos import CosmosClient, PartitionKey, exceptions
from azure.cosmos.aio import CosmosClient as AsyncCosmosClient

from config import Settings


def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


class CosmosRepo:
    """Thin async wrapper around Cosmos DB containers."""

    def __init__(self, settings: Settings):
        self._client = AsyncCosmosClient(
            url=settings.cosmos_endpoint,
            credential=settings.cosmos_key,
        )
        self._db_name = settings.cosmos_database
        self._pref_container_name = settings.cosmos_container_preferences
        self._sess_container_name = settings.cosmos_container_sessions

    async def _ensure_containers(self) -> None:
        """Idempotently create database + containers on startup."""
        db = await self._client.create_database_if_not_exists(id=self._db_name)

        await db.create_container_if_not_exists(
            id=self._pref_container_name,
            partition_key=PartitionKey(path="/user_id"),
            offer_throughput=None,  # serverless — omit throughput
        )
        await db.create_container_if_not_exists(
            id=self._sess_container_name,
            partition_key=PartitionKey(path="/user_id"),
            offer_throughput=None,
        )

    # ------------------------------------------------------------------ #
    #  Preferences                                                         #
    # ------------------------------------------------------------------ #

    async def get_preferences(self, user_id: str) -> dict | None:
        db = self._client.get_database_client(self._db_name)
        container = db.get_container_client(self._pref_container_name)
        try:
            item = await container.read_item(item=user_id, partition_key=user_id)
            return item
        except exceptions.CosmosResourceNotFoundError:
            return None

    async def upsert_preferences(self, user_id: str, prefs: dict) -> dict:
        db = self._client.get_database_client(self._db_name)
        container = db.get_container_client(self._pref_container_name)
        doc = {
            "id": user_id,
            "user_id": user_id,
            "updated_at": _utcnow(),
            **prefs,
        }
        result = await container.upsert_item(doc)
        return result

    # ------------------------------------------------------------------ #
    #  Sessions (task lists, history)                                      #
    # ------------------------------------------------------------------ #

    async def create_session(self, user_id: str, payload: dict) -> dict:
        db = self._client.get_database_client(self._db_name)
        container = db.get_container_client(self._sess_container_name)
        doc = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "created_at": _utcnow(),
            **payload,
        }
        result = await container.create_item(doc)
        return result

    async def list_sessions(self, user_id: str, limit: int = 20) -> list[dict]:
        db = self._client.get_database_client(self._db_name)
        container = db.get_container_client(self._sess_container_name)
        query = (
            "SELECT * FROM c WHERE c.user_id = @uid "
            "ORDER BY c.created_at DESC OFFSET 0 LIMIT @lim"
        )
        items = []
        async for item in container.query_items(
            query=query,
            parameters=[
                {"name": "@uid", "value": user_id},
                {"name": "@lim", "value": limit},
            ],
        ):
            items.append(item)
        return items

    async def close(self) -> None:
        await self._client.close()
