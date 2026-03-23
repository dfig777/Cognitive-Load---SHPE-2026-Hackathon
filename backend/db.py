"""
Azure Cosmos DB (NoSQL / Core API) repository.
Uses the azure-cosmos SDK with a single shared client instance.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from azure.cosmos import PartitionKey, exceptions
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
        self._conv_container_name = settings.cosmos_container_conversations
        self._docs_container_name = settings.cosmos_container_documents
        self._mem_container_name = settings.cosmos_container_user_memory
        self._patterns_container_name = settings.cosmos_container_learned_patterns
        self._tasks_container_name = settings.cosmos_container_tasks

    async def _ensure_containers(self) -> None:
        """Idempotently create database + all containers on startup."""
        db = await self._client.create_database_if_not_exists(id=self._db_name)

        for name in [
            self._pref_container_name,
            self._sess_container_name,
            self._conv_container_name,
            self._docs_container_name,
            self._mem_container_name,
            self._patterns_container_name,
            self._tasks_container_name,
        ]:
            await db.create_container_if_not_exists(
                id=name,
                partition_key=PartitionKey(path="/user_id"),
                offer_throughput=None,  # serverless — omit throughput
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

    # ------------------------------------------------------------------ #
    #  Conversations (chat history per user — single doc, latest N msgs)  #
    # ------------------------------------------------------------------ #

    async def get_conversation(self, user_id: str) -> list[dict]:
        """Returns the stored message list, or [] if none exists."""
        db = self._client.get_database_client(self._db_name)
        container = db.get_container_client(self._conv_container_name)
        doc_id = f"{user_id}_conversation"
        try:
            item = await container.read_item(item=doc_id, partition_key=user_id)
            return item.get("messages", [])
        except exceptions.CosmosResourceNotFoundError:
            return []

    async def upsert_conversation(self, user_id: str, messages: list[dict]) -> None:
        """Overwrite the stored conversation with the provided message list."""
        db = self._client.get_database_client(self._db_name)
        container = db.get_container_client(self._conv_container_name)
        doc = {
            "id": f"{user_id}_conversation",
            "user_id": user_id,
            "messages": messages,
            "updated_at": _utcnow(),
        }
        await container.upsert_item(doc)

    # ------------------------------------------------------------------ #
    #  Documents (summaries + extracted text)                             #
    # ------------------------------------------------------------------ #

    async def get_user_documents(self, user_id: str) -> list[dict]:
        """Returns all document records for the user, most recent first."""
        db = self._client.get_database_client(self._db_name)
        container = db.get_container_client(self._docs_container_name)
        query = (
            "SELECT c.id, c.filename, c.summary, c.page_count, c.created_at "
            "FROM c WHERE c.user_id = @uid "
            "ORDER BY c.created_at DESC OFFSET 0 LIMIT 10"
        )
        items = []
        async for item in container.query_items(
            query=query,
            parameters=[{"name": "@uid", "value": user_id}],
        ):
            items.append(item)
        return items

    async def upsert_document(self, user_id: str, payload: dict) -> dict:
        """Save or update a document record. payload must include 'id'."""
        db = self._client.get_database_client(self._db_name)
        container = db.get_container_client(self._docs_container_name)
        doc = {
            "user_id": user_id,
            "created_at": _utcnow(),
            **payload,
        }
        result = await container.upsert_item(doc)
        return result

    async def delete_document(self, user_id: str, doc_id: str) -> bool:
        """Delete a single document by ID. Returns True if deleted, False if not found."""
        db = self._client.get_database_client(self._db_name)
        container = db.get_container_client(self._docs_container_name)
        try:
            await container.delete_item(item=doc_id, partition_key=user_id)
            return True
        except exceptions.CosmosResourceNotFoundError:
            return False

    async def delete_all_documents(self, user_id: str) -> int:
        """Delete all documents for a user. Returns count deleted."""
        db = self._client.get_database_client(self._db_name)
        container = db.get_container_client(self._docs_container_name)
        query = "SELECT c.id FROM c WHERE c.user_id = @uid"
        count = 0
        async for item in container.query_items(
            query=query,
            parameters=[{"name": "@uid", "value": user_id}],
        ):
            try:
                await container.delete_item(item=item["id"], partition_key=user_id)
                count += 1
            except Exception:
                pass
        return count

    async def delete_conversation(self, user_id: str) -> None:
        """Delete the stored conversation history for a user."""
        db = self._client.get_database_client(self._db_name)
        container = db.get_container_client(self._conv_container_name)
        doc_id = f"{user_id}_conversation"
        try:
            await container.delete_item(item=doc_id, partition_key=user_id)
        except exceptions.CosmosResourceNotFoundError:
            pass

    async def get_document_text(self, user_id: str, doc_id: str) -> str | None:
        """Fetch full extracted text for a specific document."""
        db = self._client.get_database_client(self._db_name)
        container = db.get_container_client(self._docs_container_name)
        try:
            item = await container.read_item(item=doc_id, partition_key=user_id)
            return item.get("extracted_text")
        except exceptions.CosmosResourceNotFoundError:
            return None

    # ------------------------------------------------------------------ #
    #  User Memory (explicit memories the user asked Pebble to remember)  #
    # ------------------------------------------------------------------ #

    async def get_user_memories(self, user_id: str) -> list[str]:
        """Returns the list of memory strings for the user."""
        db = self._client.get_database_client(self._db_name)
        container = db.get_container_client(self._mem_container_name)
        doc_id = f"{user_id}_memories"
        try:
            item = await container.read_item(item=doc_id, partition_key=user_id)
            return item.get("memories", [])
        except exceptions.CosmosResourceNotFoundError:
            return []

    async def upsert_user_memories(self, user_id: str, memories: list[str]) -> None:
        db = self._client.get_database_client(self._db_name)
        container = db.get_container_client(self._mem_container_name)
        doc = {
            "id": f"{user_id}_memories",
            "user_id": user_id,
            "memories": memories,
            "updated_at": _utcnow(),
        }
        await container.upsert_item(doc)

    # ------------------------------------------------------------------ #
    #  Learned Patterns (silently detected behavioral patterns)           #
    # ------------------------------------------------------------------ #

    async def get_learned_patterns(self, user_id: str) -> list[str]:
        """Returns the list of detected pattern strings for the user."""
        db = self._client.get_database_client(self._db_name)
        container = db.get_container_client(self._patterns_container_name)
        doc_id = f"{user_id}_patterns"
        try:
            item = await container.read_item(item=doc_id, partition_key=user_id)
            return item.get("patterns", [])
        except exceptions.CosmosResourceNotFoundError:
            return []

    # ------------------------------------------------------------------ #
    #  Task Groups (persistent task state for Block 9 context)            #
    # ------------------------------------------------------------------ #

    async def get_task_groups(self, user_id: str) -> list[dict]:
        """Returns the stored task groups list, or [] if none exists."""
        db = self._client.get_database_client(self._db_name)
        container = db.get_container_client(self._tasks_container_name)
        doc_id = f"{user_id}_tasks"
        try:
            item = await container.read_item(item=doc_id, partition_key=user_id)
            return item.get("groups", [])
        except exceptions.CosmosResourceNotFoundError:
            return []

    async def upsert_task_groups(self, user_id: str, groups: list[dict]) -> None:
        """Overwrite the stored task groups with the provided list."""
        db = self._client.get_database_client(self._db_name)
        container = db.get_container_client(self._tasks_container_name)
        doc = {
            "id": f"{user_id}_tasks",
            "user_id": user_id,
            "groups": groups,
            "updated_at": _utcnow(),
        }
        await container.upsert_item(doc)

    # ------------------------------------------------------------------ #
    #  Lifecycle                                                           #
    # ------------------------------------------------------------------ #

    async def close(self) -> None:
        await self._client.close()
