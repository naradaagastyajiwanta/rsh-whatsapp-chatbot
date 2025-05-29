import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

/**
 * Mendapatkan pengguna yang terakhir dipilih dari server
 * @returns Promise dengan data pengguna yang dipilih
 */
export const getSelectedUser = async (): Promise<string | null> => {
  try {
    const response = await axios.get(`${API_BASE_URL}/admin/preferences/selected-user`, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 5000,
      withCredentials: false
    });

    if (response.status === 200 && response.data && response.data.selected_user) {
      return response.data.selected_user;
    }
    return null;
  } catch (error) {
    console.error('Error fetching selected user:', error);
    return null;
  }
};

/**
 * Menyimpan pengguna yang dipilih ke server
 * @param userId ID pengguna yang dipilih
 * @returns Promise dengan status keberhasilan
 */
export const setSelectedUser = async (userId: string): Promise<boolean> => {
  try {
    const response = await axios.post(`${API_BASE_URL}/admin/preferences/selected-user`, 
      { selected_user: userId },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 5000,
        withCredentials: false
      }
    );

    return response.status === 200 && response.data && response.data.success;
  } catch (error) {
    console.error('Error saving selected user:', error);
    return false;
  }
};
