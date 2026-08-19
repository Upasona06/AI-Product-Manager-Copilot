import sys
from unittest.mock import MagicMock
sys.modules['sentence_transformers'] = MagicMock()
sys.modules['spacy'] = MagicMock()
sys.modules['transformers'] = MagicMock()

import nltk
nltk.download = lambda *args, **kwargs: True

print("Mocks set. Importing app...")
from app import create_app
print("Import complete. Creating app...")
app = create_app()
print("App created.")
