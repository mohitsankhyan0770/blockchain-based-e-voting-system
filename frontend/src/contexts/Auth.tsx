import React, { createContext, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import axios, { setAccessToken } from "../axios";

type ContextProps = {
  children: JSX.Element;
};

type User = {
  id: number;
  name: string;
  admin: boolean;
};

export const AuthContext = createContext({
  id: 0,
  name: "",
  isAdmin: false,
  authenticated: false,
  accessToken: "",
  loading: true,
  authenticate: (user: User, token: string) => {},
  logout: () => {},
});

export default (props: ContextProps): JSX.Element => {
  const navigate = useNavigate();

  const [authentication, setAuthentication] = useState({
    id: 0,
    name: "",
    isAdmin: false,
    authenticated: false,
    accessToken: "",
    loading: true,
  });

  const checkAuthentication = () => {
    axios
      .post("/auth/check")
      .then((res) => authenticate(res.data.user, res.data.accessToken, false))
      .catch(() => {
        // no valid session (never logged in, expired, or the account was removed)
        setAccessToken("");
        setAuthentication({
          id: 0,
          name: "",
          isAdmin: false,
          authenticated: false,
          accessToken: "",
          loading: false,
        });
      });
  };

  useEffect(() => {
    checkAuthentication();

    const interval = setInterval(checkAuthentication, 4 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const authenticate = (
    user: User,
    token: string,
    redirect: boolean = true
  ) => {
    setAccessToken(token);
    setAuthentication({
      id: user.id,
      name: user.name,
      isAdmin: user.admin,
      authenticated: true,
      accessToken: token,
      loading: false,
    });

    if (redirect) navigate("/");
  };

  const logout = async () => {
    await axios.post("/auth/logout");
    setAccessToken("");

    setAuthentication({
      id: 0,
      name: "",
      isAdmin: false,
      authenticated: false,
      accessToken: "",
      loading: false,
    });

    navigate("/");
  };

  return (
    <AuthContext.Provider
      value={{
        id: authentication.id,
        name: authentication.name,
        isAdmin: authentication.isAdmin,
        authenticated: authentication.authenticated,
        accessToken: authentication.accessToken,
        loading: authentication.loading,
        authenticate,
        logout,
      }}
    >
      {props.children}
    </AuthContext.Provider>
  );
};
