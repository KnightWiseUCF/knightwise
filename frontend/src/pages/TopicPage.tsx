// this page displays the available topics
import React from "react";
import Layout from "../components/Layout";
import TopicCard from "../components/TopicCard";

const TopicPage: React.FC = () => (
  <Layout>
    <h1 className="my-4 pt-4 text-center text-2xl font-bold sm:my-6 sm:pt-6 sm:text-4xl md:text-5xl">Choose your topics</h1>
    <TopicCard />
  </Layout>
);

export default TopicPage;

