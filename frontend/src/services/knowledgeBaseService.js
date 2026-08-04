const API_URL = "http://127.0.0.1:5000";

export const getContext = async (query) => {
  try {
    const response = await fetch(`${API_URL}/api/context/${query}`);

    if (!response.ok) {
      throw new Error("Failed to fetch context");
    }

    return await response.json();
  } catch (error) {
    console.error(error);
    return { context: [] };
  }
};