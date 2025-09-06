# Welcome to Cloud Functions for Firebase for Python!
# To get started, simply uncomment the below code or create your own.
# Deploy with `firebase deploy`

from firebase_functions import https_fn, options
from firebase_admin import initialize_app, firestore
import json

# Initialization
# The app object in `firebase_admin` is a singleton, so it's safe to initialize it here.
initialize_app()
db = firestore.client()

@https_fn.on_request()
def getItems(req: https_fn.Request) -> https_fn.Response:
    """Gets all documents from the 'items' collection."""
    try:
        items_ref = db.collection('items')
        docs = items_ref.stream()

        items = []
        for doc in docs:
            item_data = doc.to_dict()
            item_data['id'] = doc.id
            items.append(item_data)

        if not items:
            return https_fn.Response("No items found", status=404)

        return https_fn.Response(json.dumps(items), status=200, mimetype="application/json")

    except Exception as e:
        print(f"Error fetching items from Firestore: {e}")
        return https_fn.Response("Internal Server Error", status=500)
