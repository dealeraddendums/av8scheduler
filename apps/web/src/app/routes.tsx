import { createBrowserRouter } from "react-router";
import RootLayout from "./layouts/RootLayout";
import Home from "./views/Home";
import Settings from "./views/Settings";
import NotFound from "./views/NotFound";

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        path: "/",
        element: <Home />,
      },
      {
        path: "/settings",
        element: <Settings />,
      },
      {
        path: "*",
        element: <NotFound />,
      },
    ],
  },
]);