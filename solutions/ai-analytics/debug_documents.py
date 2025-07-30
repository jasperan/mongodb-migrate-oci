import yaml
import oracledb
from soda_utils import SodaUtils

def debug_documents():
    """Debug document structure in SODA collection"""
    print("🔍 Debugging SODA collection documents...")
    
    try:
        # Load config
        with open('config.yaml', 'r') as f:
            config = yaml.safe_load(f)
        
        # Initialize SODA
        soda_utils = SodaUtils(config)
        
        # List all documents
        documents = soda_utils.list_all_documents()
        
        if documents:
            print("\n📋 Document details:")
            for i, doc in enumerate(documents):
                print(f"\n📄 Document {i+1}:")
                print(f"   _id: {doc.get('_id')} (type: {type(doc.get('_id'))})")
                print(f"   Keys: {list(doc.keys())}")
                
                # Test different ID formats
                doc_id = doc.get('_id')
                if doc_id:
                    print(f"   Original ID: {doc_id}")
                    print(f"   String representation: '{str(doc_id)}'")
                    print(f"   Repr: {repr(doc_id)}")
                    
                    # Explore JsonId object attributes
                    if hasattr(doc_id, '__class__') and 'JsonId' in str(type(doc_id)):
                        print(f"   JsonId dir: {[attr for attr in dir(doc_id) if not attr.startswith('_')]}")
                        print(f"   JsonId type: {type(doc_id)}")
                        print(f"   JsonId module: {doc_id.__class__.__module__}")
                        
                        # Try to access underlying data
                        try:
                            if hasattr(doc_id, 'value'):
                                print(f"   JsonId.value: {doc_id.value}")
                        except:
                            pass
                        
                        try:
                            if hasattr(doc_id, 'bytes'):
                                print(f"   JsonId.bytes: {doc_id.bytes}")
                        except:
                            pass
                    
                    if isinstance(doc_id, bytes):
                        print(f"   Hex string: {doc_id.hex()}")
                    elif hasattr(doc_id, '__class__') and 'JsonId' in str(type(doc_id)):
                        print(f"   JsonId string: '{str(doc_id)}'")
                        print(f"   JsonId repr: {repr(doc_id)}")
                    else:
                        print(f"   String: {str(doc_id)}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        print(f"🔍 Traceback: {traceback.format_exc()}")

if __name__ == "__main__":
    debug_documents() 