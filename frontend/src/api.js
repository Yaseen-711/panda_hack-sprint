import axios from 'axios';

const API_URL = 'http://localhost:3000/api';

export const loginUser = async (username, password) => {
    const response = await axios.post(`${API_URL}/login`, { username, password });
    return response.data;
};

export const sendIntent = async (userInput, username, password, dryRun = false) => {
    const response = await axios.post(`${API_URL}/intent`, { userInput, username, password, dryRun });
    return response.data;
};

export const fetchHistory = async (username) => {
    const response = await axios.get(`${API_URL}/history?username=${encodeURIComponent(username)}`);
    return response.data;
};

export const fetchRealBalance = async (address) => {
    const response = await axios.get(`${API_URL}/shardeum/balance/${address}`);
    return response.data;
};

export const addContact = async (username, contactName, address) => {
    const response = await axios.post(`${API_URL}/add-contact`, { username, contactName, address });
    return response.data;
};
