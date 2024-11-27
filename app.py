from flask import Flask, render_template, jsonify
from flask_cors import CORS
from pymongo import MongoClient
import requests
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Constants
API_KEY = "15003d12-baf7-4ac1-b5a1-0aeb8dff76b6"
PLAYER_IDS = {
    "M8 Vanyak3k": "79f1994f55eb4931a148935efa188b2f",
    "M8 PodaSai": "781c9df9b5f1483a9d06de87be5467aa",
    "xsweeze2005": "95b8c65a16ec4322824da21fe511371a",
    "akiirarr": "077d69a8f1ea43e4bf8f1273dc0b5aa5",
    "KC%20Merstach%C7%83": "5bec82879fbf436887597f49d9bcc7c3",
}

# MongoDB connection
class MongoDBHandler:
    def __init__(self):
        self.client = MongoClient("mongodb+srv://google_colab_Fortnite_script:clwwQLdpK1BPHkoR@cluster0.2m4lj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0")
        self.db = self.client['M8_data']
        self.collection = self.db['fortnite_Stats']

    def get_all_stats(self):
        try:
            cursor = self.collection.find({}, {'_id': 0})
            return list(cursor)
        except Exception as e:
            print(f"Error getting stats: {e}")
            return []

    def window_exists(self, epic_id, event_id, window_id):
        return self.collection.find_one({
            'epic_id': epic_id,
            'event_id': event_id,
            'window_id': window_id
        }) is not None

    def add_stats(self, stats_dict):
        try:
            self.collection.insert_one(stats_dict)
            return True
        except Exception as e:
            print(f"Error adding stats: {e}")
            return False

# Initialize MongoDB handler
db_handler = MongoDBHandler()

@app.route('/')
def index():
    return render_template('index.html', player_ids=PLAYER_IDS)

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Get all stats from MongoDB."""
    stats = db_handler.get_all_stats()
    return jsonify(stats)

@app.route('/api/refresh', methods=['POST'])
def refresh_data():
    """Refresh tournament data."""
    try:
        new_windows_added = False

        for player_name, epic_id in PLAYER_IDS.items():
            # Get player tournaments
            url = "https://api.osirion.gg/fortnite/v1/tournaments"
            headers = {"Authorization": f"Bearer {API_KEY}"}
            params = {"epicIds": [epic_id]}
            
            response = requests.get(url, headers=headers, params=params)
            if response.status_code == 200:
                tournaments = response.json().get('tournaments', [])
                
                for tournament in tournaments:
                    event_id = tournament['eventId']
                    window_id = tournament['eventWindowId']
                    
                    if not db_handler.window_exists(epic_id, event_id, window_id):
                        # Get stats for new window
                        stats = ["eliminations", "assists", "shots", "headshots", 
                                "hitsToPlayers", "damageToPlayers", "healthTaken", 
                                "healthHealed", "shieldHealed", "rebootedCount", 
                                "revivedCount"]
                        joined_stats = ",".join(stats)
                        
                        url = f"https://api.osirion.gg/fortnite/v1/tournaments/stats?eventId={event_id}&eventWindowId={window_id}&epicIds={epic_id}&include={joined_stats}"
                        response = requests.get(url, headers=headers)
                        
                        if response.status_code == 200:
                            data = response.json()
                            if data.get('players'):
                                stats_dict = data['players'][0]
                                stats_dict.update({
                                    'epic_id': epic_id,
                                    'epic_username': player_name,
                                    'event_id': event_id,
                                    'window_id': window_id
                                })
                                db_handler.add_stats(stats_dict)
                                new_windows_added = True

        return jsonify({
            'success': True,
            'message': 'Refresh complete',
            'newData': new_windows_added,
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True)