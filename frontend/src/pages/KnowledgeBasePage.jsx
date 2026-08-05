import React, { useState } from "react";
import { getContext } from "../services/knowledgeBaseService";

function KnowledgeBasePage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (query.trim() === "") {
      alert("Please enter a search query");
      return;
    }

    setLoading(true);

    try {
      const data = await getContext(query);
      setResults(data.context || []);
    } catch (error) {
      console.error(error);
      alert("Failed to retrieve context.");
    }

    setLoading(false);
  };

  return (
    <div style={{ padding: "30px" }}>
      <h1>🧠  Knowledge Base & RAG Engine</h1>

      <p>
        Search the knowledge base using Semantic Search and Context Retrieval.
      </p>

      <div style={{ marginTop: "20px" }}>
        <input
          type="text"
          placeholder="Enter query..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            width: "350px",
            padding: "10px",
            marginRight: "10px",
            borderRadius: "5px"
          }}
        />

        <button
          onClick={handleSearch}
          style={{
            padding: "10px 20px",
            cursor: "pointer"
          }}
        >
          Search
        </button>
      </div>

      <hr style={{ margin: "25px 0" }} />

      <h2>Retrieved Context</h2>

      {loading ? (
        <p>Loading...</p>
      ) : results.length === 0 ? (
        <p>No results found.</p>
      ) : (
        <ul>
          {results.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default KnowledgeBasePage;