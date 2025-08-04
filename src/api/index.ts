import express from "express";
import { responseHandler } from "./middleware/responseHandler";
import { errorHandler } from "./middleware/errorHandler";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(responseHandler);
app.use(errorHandler);

app.listen(9999, () => {
  console.log("Server is running on port 9999");
});

export default app;
