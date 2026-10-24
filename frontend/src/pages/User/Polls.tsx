import React, { useContext, useEffect, useState } from "react";
import axios from "../../axios";
import Chart from "../../components/Polls/Chart";
import Finished from "../../components/Polls/Finished";
import Panel from "../../components/Polls/Panel";
import Running from "../../components/Polls/Running";
import Waiting from "../../components/Waiting";
import { AuthContext } from "../../contexts/Auth";

const User = () => {
  const [voteState, setVoteStatus] = useState<
    "finished" | "running" | "not-started" | "checking"
  >("checking");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ name: "", description: "", votes: {} });
  const [votable, setVotable] = useState("");

  const authContext = useContext(AuthContext);

  useEffect(() => {
    axios
      .get("/polls/status")
      .then((res) => {
        setVoteStatus(res.data.status);
        setLoading(false);
      })
      .catch((error) => console.log({ error }));
  }, []);

  useEffect(() => {
    if (voteState !== "checking") {
      axios.get("/polls/").then((res) => {
        setData(res.data);
        setLoading(false);
      });

      axios
        .post("/polls/check-voteability")
        .then((res) => {
          setVotable(res.data);
        })
        .catch(() => setVotable(""));
    }
  }, [voteState]);

  if (loading || voteState === "checking") return <div></div>;

  if (voteState === "not-started") return <Waiting />;

  return (
    <Panel name={data.name} description={data.description}>
      <>
        {voteState === "running" ? <Running /> : <Finished />}

        <Chart
          enableVote={votable === "not-voted"}
          userId={authContext.id}
          userName={authContext.name}
          votes={data.votes}
        />
      </>
    </Panel>
  );
};

export default User;
