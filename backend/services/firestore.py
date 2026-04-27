"""Storage abstraction: Firestore (firebase-admin) with in-memory fallback.

All callers use the module-level functions ``set_doc`` / ``get_doc`` / ``list_docs``
/ ``delete_doc``. The underlying store is selected at startup via ``init_store()``
based on whether a valid service-account JSON path is present.
"""

from __future__ import annotations

import logging
import threading
from typing import Any, Dict, List, Optional

from config import get_settings

log = logging.getLogger("chainguard.firestore")


class _Store:
    def set(self, collection: str, doc_id: str, data: Dict[str, Any]) -> None: ...
    def get(self, collection: str, doc_id: str) -> Optional[Dict[str, Any]]: ...
    def list(self, collection: str) -> List[Dict[str, Any]]: ...
    def delete(self, collection: str, doc_id: str) -> None: ...


class InMemoryStore(_Store):
    def __init__(self) -> None:
        self._data: Dict[str, Dict[str, Dict[str, Any]]] = {}
        self._lock = threading.Lock()

    def set(self, collection: str, doc_id: str, data: Dict[str, Any]) -> None:
        with self._lock:
            self._data.setdefault(collection, {})[doc_id] = dict(data)

    def get(self, collection: str, doc_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            doc = self._data.get(collection, {}).get(doc_id)
            return dict(doc) if doc else None

    def list(self, collection: str) -> List[Dict[str, Any]]:
        with self._lock:
            return [dict(v) for v in self._data.get(collection, {}).values()]

    def delete(self, collection: str, doc_id: str) -> None:
        with self._lock:
            self._data.get(collection, {}).pop(doc_id, None)


class FirestoreStore(_Store):
    def __init__(self, sa_path: str) -> None:
        import firebase_admin
        from firebase_admin import credentials, firestore as fa_firestore

        if not firebase_admin._apps:
            cred = credentials.Certificate(sa_path)
            firebase_admin.initialize_app(cred)
        self._db = fa_firestore.client()

    def set(self, collection: str, doc_id: str, data: Dict[str, Any]) -> None:
        self._db.collection(collection).document(doc_id).set(data)

    def get(self, collection: str, doc_id: str) -> Optional[Dict[str, Any]]:
        snap = self._db.collection(collection).document(doc_id).get()
        return snap.to_dict() if snap.exists else None

    def list(self, collection: str) -> List[Dict[str, Any]]:
        return [doc.to_dict() for doc in self._db.collection(collection).stream()]

    def delete(self, collection: str, doc_id: str) -> None:
        self._db.collection(collection).document(doc_id).delete()


_store: _Store = InMemoryStore()


def init_store() -> None:
    """Select Firestore if creds exist, otherwise stay in-memory."""
    global _store
    settings = get_settings()
    if settings.has_firestore:
        try:
            _store = FirestoreStore(settings.firestore_sa_json)
            log.info("Firestore initialised via service account: %s", settings.firestore_sa_json)
            return
        except Exception as exc:
            log.warning("Firestore init failed, falling back to in-memory: %s", exc)
    _store = InMemoryStore()
    log.info("Using in-memory store (no Firestore credentials supplied).")


def set_doc(collection: str, doc_id: str, data: Dict[str, Any]) -> None:
    _store.set(collection, doc_id, data)


def get_doc(collection: str, doc_id: str) -> Optional[Dict[str, Any]]:
    return _store.get(collection, doc_id)


def list_docs(collection: str) -> List[Dict[str, Any]]:
    return _store.list(collection)


def delete_doc(collection: str, doc_id: str) -> None:
    _store.delete(collection, doc_id)
