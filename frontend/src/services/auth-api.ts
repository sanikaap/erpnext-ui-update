// src/services/auth-api.ts

import {
  request,
  erpnextApi,
} from "./erpnext-api";


export const authApi = {

  async login(
    username: string,
    password: string
  ) {

    return request(
      "/method/login",
      {
        method: "POST",

        body: JSON.stringify({
          usr: username,
          pwd: password,
        }),
      }
    );
  },


  async getCurrentUser() {

    return erpnextApi.getLoggedUser();
  },


  async getUser(
    username: string
  ) {

    return erpnextApi.getDoc(
      "User",
      username
    );
  },


  async logout() {

    return request(
      "/method/logout",
      {
        method: "POST",
      }
    );
  },


  async checkSession() {

    try {

      const response =
        await this.getCurrentUser();

      return {
        authenticated:
          response.message !== "Guest",

        user:
          response.message,
      };

    } catch {

      return {
        authenticated: false,
        user: null,
      };
    }
  },
};


export default authApi;