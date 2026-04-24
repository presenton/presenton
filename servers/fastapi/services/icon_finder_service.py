import asyncio
import json
import os
from fastembed_vectorstore import FastembedEmbeddingModel, FastembedVectorstore
from utils.path_helpers import get_resource_path, get_writable_path


class IconFinderService:
    def __init__(self):
        self.model = FastembedEmbeddingModel.AllMiniLML6V2
        # Use writable path for cache since it needs to be modified
        self.cache_directory = get_writable_path("fastembed_cache")
        self.vectorstore = None
        self._initialized = False
        self._initialization_failed = False

    def _initialize_icons_collection(self):
        if self._initialized or self._initialization_failed:
            return
        
        # Mark as initialized immediately to prevent repeated attempts
        self._initialized = True
            
        print("Initializing icons collection...")
        
        # Ensure cache directory exists
        try:
            os.makedirs(self.cache_directory, exist_ok=True)
        except Exception as e:
            print(f"Warning: Could not create cache directory: {e}")
            self._initialization_failed = True
            return
            
        try:
            # Try bundled vectorstore first (read-only location)
            bundled_vectorstore_path = get_resource_path("assets/icons-vectorstore.json")
            # Writable location for user-created vectorstore (directory + filename)
            writable_assets_dir = get_writable_path("assets")
            writable_vectorstore_path = os.path.join(
                writable_assets_dir, "icons-vectorstore.json"
            )
            # Icons JSON should be in bundled assets
            icons_path = get_resource_path("assets/icons.json")
            
            print(f"[IconFinder] Bundled vectorstore path: {bundled_vectorstore_path}")
            print(f"[IconFinder] Writable vectorstore path: {writable_vectorstore_path}")
            print(f"[IconFinder] Icons.json path: {icons_path}")
            print(f"[IconFinder] Cache directory: {self.cache_directory}")
            print(f"[IconFinder] Bundled vectorstore exists: {os.path.isfile(bundled_vectorstore_path)}")
            print(f"[IconFinder] Writable vectorstore exists: {os.path.isfile(writable_vectorstore_path)}")
            print(f"[IconFinder] Icons.json exists: {os.path.isfile(icons_path)}")
            
            # Try to load from bundled location first, then writable location
            # Use os.path.isfile() instead of os.path.exists() to avoid loading directories
            vectorstore_path = None
            if os.path.isfile(bundled_vectorstore_path):
                vectorstore_path = bundled_vectorstore_path
                print(f"[IconFinder] Loading vectorstore from bundled location: {vectorstore_path}")
            elif os.path.isfile(writable_vectorstore_path):
                vectorstore_path = writable_vectorstore_path
                print(f"[IconFinder] Loading vectorstore from writable location: {vectorstore_path}")
            
            if vectorstore_path:
                self.vectorstore = FastembedVectorstore.load(
                    self.model, vectorstore_path, cache_directory=self.cache_directory
                )
                print("[IconFinder] Vectorstore loaded successfully")
            elif os.path.isfile(icons_path):
                print(f"[IconFinder] Creating new vectorstore from {icons_path}")
                self.vectorstore = FastembedVectorstore(
                    self.model, cache_directory=self.cache_directory
                )
                with open(icons_path, "r", encoding="utf-8") as f:
                    icons = json.load(f)

                documents = []

                for each in icons["icons"]:
                    if each["name"].split("-")[-1] == "bold":
                        doc_text = f"{each['name']}||{each['tags']}"
                        documents.append(doc_text)

                if documents:
                    print(f"[IconFinder] Embedding {len(documents)} icons...")
                    success = self.vectorstore.embed_documents(documents)
                    if success:
                        print(f"[IconFinder] Successfully embedded {len(documents)} icons")
                        # Save to writable location
                        try:
                            os.makedirs(os.path.dirname(writable_vectorstore_path), exist_ok=True)
                            self.vectorstore.save(writable_vectorstore_path)
                            print(f"[IconFinder] Vectorstore saved to {writable_vectorstore_path}")
                        except Exception as e:
                            print(f"[IconFinder] Warning: Could not save vectorstore: {e}")
                            # Continue anyway - vectorstore is still usable in memory
                    else:
                        print(f"[IconFinder] Failed to embed icons")
                        self._initialization_failed = True
                else:
                    print(f"[IconFinder] No icons found to embed")
                    self._initialization_failed = True
            else:
                print(f"[IconFinder] ERROR: Icons assets not found at {icons_path}")
                self._initialization_failed = True
            
            if not self._initialization_failed:
                print("[IconFinder] Icons collection initialized successfully.")
        except Exception as e:
            print(f"Warning: Could not initialize icon finder service: {e}")
            print(f"Error type: {type(e).__name__}")
            print("Icon search will be disabled.")
            self._initialization_failed = True
            # Keep vectorstore as None so search_icons returns empty results

    def ensure_initialized(self) -> bool:
        if not self._initialized and not self._initialization_failed:
            self._initialize_icons_collection()
        return self.vectorstore is not None and not self._initialization_failed

    async def search_icons(self, query: str, k: int = 1):
        if not self.ensure_initialized():
            # Return empty list if vectorstore failed to initialize
            return []
            
        try:
            result = await asyncio.to_thread(self.vectorstore.search, query, k)
            return [
                f"/static/icons/bold/{each[0].split('||')[0]}.svg"
                for each in result
            ]
        except Exception as e:
            print(f"Icon search error: {e}")
            return []


ICON_FINDER_SERVICE = IconFinderService()
