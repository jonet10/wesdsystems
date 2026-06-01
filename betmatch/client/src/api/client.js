import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "",
  withCredentials: true,
});

export const apiGet = async (path) => {
  const { data } = await api.get(path);
  return data;
};
