import React, { useState } from 'react';
import axios from 'axios';

export default function AdminDbPanel() {
  const [mongoCollections, setMongoCollections] = useState([]);
  const [mongoCounts, setMongoCounts] = useState({});
  const [oracleTables, setOracleTables] = useState([]);
  const [oracleCounts, setOracleCounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchMongoCollections = async () => {
    setLoading(true); setError('');
    try {
      const { data } = await axios.get('/api/admin-db/collections/mongo');
      setMongoCollections(data);
      // Fetch counts for each collection
      const counts = {};
      for (const name of data) {
        const res = await axios.get(`/api/admin-db/collections/mongo/${name}/count`);
        counts[name] = res.data.count;
      }
      setMongoCounts(counts);
    } catch (err) {
      setError('Failed to fetch MongoDB collections');
    }
    setLoading(false);
  };

  const fetchOracleTables = async () => {
    setLoading(true); setError('');
    try {
      const { data } = await axios.get('/api/admin-db/collections/oracle');
      setOracleTables(data);
      // Fetch counts for each table
      const counts = {};
      for (const name of data) {
        const res = await axios.get(`/api/admin-db/collections/oracle/${name}/count`);
        counts[name] = res.data.count;
      }
      setOracleCounts(counts);
    } catch (err) {
      setError('Failed to fetch Oracle tables');
    }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <h3>Admin DB Panel</h3>
      <button onClick={fetchMongoCollections} disabled={loading} style={{ marginRight: 8 }}>Refresh MongoDB</button>
      <button onClick={fetchOracleTables} disabled={loading}>Refresh OracleDB</button>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      <div style={{ marginTop: 16 }}>
        <h4>MongoDB Collections</h4>
        <ul>
          {mongoCollections.map(name => (
            <li key={name}>{name} ({mongoCounts[name] ?? '?'})</li>
          ))}
        </ul>
      </div>
      <div style={{ marginTop: 16 }}>
        <h4>OracleDB Tables</h4>
        <ul>
          {oracleTables.map(name => (
            <li key={name}>{name} ({oracleCounts[name] ?? '?'})</li>
          ))}
        </ul>
      </div>
    </div>
  );
} 