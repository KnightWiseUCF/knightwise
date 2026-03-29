// For Professors to view the statistics on questions

import React, { useCallback, useEffect, useState, useMemo, useRef } from "react";
import api from "../api";
import Layout from "../components/Layout";
import { ALL_TOPICS} from "../utils/topicLabels"
import { RawQuestion, HistoryEntry, HistoryResponse, ProgressData} from '../models';
import { getProfilePictureUrlByItemName } from "../utils/storeCosmetics";
import { getBackgroundUrlByItemName } from "../utils/storeCosmetics";
import { useUserCustomizationStore, userCustomizationStore } from "../stores/userCustomizationStore";
import { isAxiosError } from "axios";
import { Key } from "lucide-react";

interface StatData {
    medianAccuracy?:        number;
    medianElapsedTime?:     number;
    responseCount:          number;
}

interface SubcategoryBreakdown
{
    [key: string]: {
        medianAccuracy?:        number | null;
        medianElapsedTime?:     number | null;
        responseCount:          number;
    }
}

interface AggregateStatsResponse
{
    medianAccuracy?:        number | null;
    medianElapsedTime?:     number | null;
    responseCount:          number;
    subcategoryBreakdown:   SubcategoryBreakdown;
}

interface AggregateStatsByQuestionResponse
{
    questionID:             number;
    medianAccuracy?:        number | null;
    medianElapsedTime?:     number | null;
    responseCount:          number;
}

interface CheckQuestion
{
    questionID:             number;
    isChecked:              boolean;

}

interface PublishedQuestion {
  id: number;
  section: string;
  category: string;
  subcategory: string;
  questionType: string;
  authorExamId: string;
  ownerId: number;
}

const topicCategoryMap: Record<string, string[]> = {
  "Introductory Programming": ["Input/Output", "Branching", "Loops", "Variables"],
  "Simple Data Structures": ["Arrays", "Linked Lists", "Strings"],
  "Object Oriented Programming": ["Classes", "Methods"],
  "Intermediate Data Structures": ["Trees", "Stacks"],
  "Complex Data Structures": ["Heaps", "Tries"],
  "Intermediate Programming": ["Bitwise Operators", "Dynamic Memory", "Algorithm Analysis", "Recursion", "Sorting"],
};

const defaultSubcategories = Object.values(topicCategoryMap).flat();

type QuestionStatus = "Draft" | "Published";

interface ProfessorQuestionItem {
  id: number;
  title: string;
  category: string;
  subcategory: string;
  status: QuestionStatus;
}

interface DraftListResponse {
  drafts?: RawQuestion[];
}

const ProfessorStatisticsPage: React.FC = () => 
{
    const [questions, setQuestions] = useState<ProfessorQuestionItem[]>([]);
    const [publishedQuestions, setPublishedQuestions] = useState<PublishedQuestion[]>([]);
    const [checkQuestions, setCheckQuestions] = useState<CheckQuestion[]>([]);

    const [aggregateStats, setAggregateStats] = useState<AggregateStatsResponse>();
    const [questionsAggregateStats, setQuestionsAggregateStats] = useState<AggregateStatsByQuestionResponse[]>([]);
    const [topicStats, setTopicStats]   = useState<StatData | null>();
    const [questionStats, setQuestionStats] = useState<StatData>();

    const [statsRetrieved, setStatsRetrieved] = useState<boolean>(false);
    const [questionsRetrieved, setQuestionsRetrieved] = useState<boolean>(false);
    const [questionStatsRetrieved, setQuestionStatsRetrieved] = useState<boolean>(false);
    const [currentQuestionID, setCurrentQuestionID] = useState<number>(-1);

    const [loading, setLoading]       = useState(false);
    const [error, setError]           = useState<string | null>(null);

    const [topicChoice, setTopicChoice] = useState<string>("All");

    const { equippedItems } = useUserCustomizationStore();
    const { user } = useUserCustomizationStore();

    var topicStatsLoaded: boolean = false;

    const isProfessor = localStorage.getItem("account_type") === "professor";

    

    const fetchAggregateStats = useCallback( async () => 
    {
        setLoading(true);
        setError(null);
        setStatsRetrieved(false);
        const token = localStorage.getItem('token');

        try
        {
            const response = await api.get<AggregateStatsResponse>(`/api/stats/aggregate`,
            {
                headers: { 'Authorization': `Bearer ${token}` },
            });

            setAggregateStats(response.data);
            console.log(response.data)

        }
        catch
        {
            setError("Failed to load aggregate stats. Please try again.");
        }
        finally
        {
            setStatsRetrieved(true);
            setLoading(false);
        }
    }, []);

    const fetchQuestionAggregateStats =  useCallback(async (checkQuestions: CheckQuestion[]) => 
    {   
        //console.log('in fetch, checkquestions: ',checkQuestions);

        if (checkQuestions.length < 1)
            return;

        setLoading(true);
        setError(null);
        setQuestionStatsRetrieved(false);
        const token = localStorage.getItem('token');

        try
        {
            let temp: AggregateStatsByQuestionResponse[] = [];

            for(let i = 0; i < checkQuestions.length; i++)
            {
                if(checkQuestions[i].isChecked) {
                    const response = await api.get<AggregateStatsByQuestionResponse>(`/api/stats/aggregate/${checkQuestions[i].questionID}`,
                    {
                        headers: { 'Authorization': `Bearer ${token}` },
                    });
                    temp.push(response.data);
                }
            }

            /*
            checkQuestions.map(async (question) => {
                if(question.isChecked) {
                    const response = await api.get<AggregateStatsByQuestionResponse>(`/api/stats/aggregate/${question.questionID}`,
                    {
                        headers: { 'Authorization': `Bearer ${token}` },
                    });
                    temp.push(response.data);
                    //temp.length++;
                }
            })
            */

            //console.log('responses: ',temp);
            //console.log('responses[0]: ', temp[0]);
            //console.log('responses.length: ', temp.length);
            setQuestionsAggregateStats(temp);
        }
        catch
        {
            setError("Failed to load Question Stats. Please try again.");
        }
        finally
        {
            setQuestionStatsRetrieved(true);
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAggregateStats();
    }, [])

    useEffect(() => {
        fetchQuestionAggregateStats(checkQuestions);
    }, [checkQuestions])

    
    useEffect(() => {
        console.log('check questions', checkQuestions); 
    }, [checkQuestions])
    

    useEffect(() => {
        resolveTopicData('All');
    }, [aggregateStats])

    useEffect(() => {
        topicStatsLoaded = true;
    }, [topicStats])

    useEffect(() => {
        const fetchPublishedQuestions = async () => {
        if (!isProfessor) {
            return;
        }

        setQuestionsRetrieved(false);
        setLoading(true);
        setError("");

        try {
            // Get published raw questions
            const res = await api.get<{published: RawQuestion[] }>("/api/admin/published");
            const questions = Array.isArray(res.data?.published) ? res.data.published : [];

            // Map to published question type and sort
            const mapped = questions
            .map((question): PublishedQuestion => ({
                id: question.ID,
                section: question.SECTION,
                category: question.CATEGORY,
                subcategory: question.SUBCATEGORY,
                questionType: question.TYPE,
                authorExamId: question.AUTHOR_EXAM_ID,
                ownerId: question.OWNER_ID,
            }))
            .sort((first, second) => second.id - first.id);

            setPublishedQuestions(mapped);
            //console.log(mapped)
            
        } catch {
            setError("Failed to load published questions.");
            setPublishedQuestions([]);
        } finally {
            setQuestionsRetrieved(true);
            setLoading(false);
        }
        };

        fetchPublishedQuestions();
    }, [isProfessor]);

    useEffect(() => {
        const temp: CheckQuestion[] = [];
        
        for (let i = 0; i < publishedQuestions.length; i++)
        {
            temp.push({questionID: publishedQuestions[i].id, isChecked: false})
        }

        setCheckQuestions(temp);

    }, [questionsRetrieved])

    useEffect(() =>
    {
        updateQuestionStats(questionsAggregateStats);
    }, [questionsAggregateStats]);

    useEffect(() =>
      {
        void userCustomizationStore.refresh();
      }, []);
      
      const backgroundItem = useMemo(
        () => equippedItems.find((item) => item.TYPE === "background") || null,
        [equippedItems]
      );
    
      const backgroundUrl = useMemo(
        () => (backgroundItem ? getBackgroundUrlByItemName(backgroundItem.NAME) : null),
        [backgroundItem]
      );
    
      const backgroundStyle = backgroundUrl ? {
        backgroundImage: `linear-gradient(rgba(245,245,245,0.86), rgba(245,245,245,0.86)), url(${backgroundUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      } : undefined;



    const resolveTopicData = (topicChoice: string) => 
    {


        //console.log(topicChoice)
        //console.log(aggregateStats)
        if (topicChoice.toLowerCase() === "All".toLowerCase()){
            let topicData: StatData = {
                medianAccuracy:     aggregateStats?.medianAccuracy == undefined ? 0 : aggregateStats?.medianAccuracy == null ? 0 : aggregateStats.medianAccuracy,
                medianElapsedTime:  aggregateStats?.medianElapsedTime == undefined ? 0 : aggregateStats?.medianElapsedTime == null ? 0 : aggregateStats.medianElapsedTime,
                responseCount:      aggregateStats?.responseCount == undefined ? 0 : aggregateStats?.responseCount == null ? 0 : aggregateStats.responseCount
            };
            setTopicStats(topicData);
            
        }
        else {
            setTopicStats({medianAccuracy: 0, medianElapsedTime: 0, responseCount: 0});
            ALL_TOPICS.map((topic) => {
                if(topic.toLowerCase() === topicChoice.toLowerCase() && aggregateStats?.subcategoryBreakdown[topicChoice] != undefined)
                {
                    let topicData: StatData = {
                        medianAccuracy: aggregateStats?.subcategoryBreakdown[topicChoice]?.medianAccuracy == undefined ? 0 : aggregateStats?.subcategoryBreakdown[topicChoice]?.medianAccuracy == null ? 0 : aggregateStats?.subcategoryBreakdown[topicChoice].medianAccuracy,
                        medianElapsedTime: aggregateStats?.subcategoryBreakdown[topicChoice]?.medianElapsedTime == undefined ? 0 : aggregateStats?.subcategoryBreakdown[topicChoice]?.medianElapsedTime == null ? 0 : aggregateStats?.subcategoryBreakdown[topicChoice].medianElapsedTime,
                        responseCount: aggregateStats?.subcategoryBreakdown[topicChoice]?.responseCount == undefined ? 0 : aggregateStats?.subcategoryBreakdown[topicChoice]?.responseCount == null ? 0 : aggregateStats?.subcategoryBreakdown[topicChoice].responseCount,
                    };  
                    setTopicStats(topicData);
                    
                }
            })
        }
        
        

        //setLoading(false)
    };

    const updateCheckQuestions = (id: number, checked: boolean ) => {
        let temp: CheckQuestion[] = [];
        checkQuestions.map((checkQuestion) => (
            checkQuestion.questionID === id 
                ?   temp.push({questionID: checkQuestion.questionID, isChecked: checked})
                :   temp.push({questionID: checkQuestion.questionID, isChecked: checkQuestion.isChecked})
        ))

        setCheckQuestions(temp);
    }

    const updateQuestionStats = (questionsAggregateStats: AggregateStatsByQuestionResponse[]) => {
        //console.log('question stats',questionsAggregateStats)
        //console.log('question stats[0] ',questionsAggregateStats[0])
        //console.log('question stats length ',questionsAggregateStats.length)

        /*
        let questionsAggregateStats2: AggregateStatsByQuestionResponse[] = questionsAggregateStats;
        console.log(questionsAggregateStats2)
        console.log(questionsAggregateStats2.length)
        */


        
        if (questionsAggregateStats.length < 1)
            return;
        
        
        const length = questionsAggregateStats.length;
        let totalMedianElapsedTime = 0;
        let totalMedianAccuracy = 0;
        let totalQuestionsCompleted = 0;

        questionsAggregateStats.map((question) => {
            totalMedianElapsedTime += question?.medianAccuracy == undefined || question?.medianAccuracy == null ? 0 : question?.medianAccuracy;
            totalMedianElapsedTime += question?.medianElapsedTime == undefined || question?.medianElapsedTime == null ? 0 : question?.medianElapsedTime;
            totalMedianElapsedTime += question?.responseCount == undefined || question?.responseCount == null ? 0 : question?.responseCount;
        })

        //console.log('questions stats: ', 'medAcc', totalMedianAccuracy / length, 'medTime', totalMedianElapsedTime / length, 'questions', totalQuestionsCompleted)

        setQuestionStats({
            medianAccuracy: totalMedianAccuracy / length,
            medianElapsedTime: totalMedianElapsedTime / length,
            responseCount: totalQuestionsCompleted
        })

        //setLoading(false)

    }

    const getPercentageGraphs = () => {

        
            return (
                <div className="flex items-end gap-2 h-30">
                    <div className="flex-1 min-w-0 flex flex-col items-center gap-1">
                        <div className="w-1/4 h-14 flex items-end">
                            <div className={`w-full rounded-t text-white text-center text-sm
                                ${topicStats?.medianAccuracy !== undefined ? (topicStats?.medianAccuracy > 0  ? "bg-blue-500" : "bg-gray-300") : "bg-gray-300"}`}
                                style={{ height: `${Math.max(12, (topicStats?.medianAccuracy !== undefined && topicStats?.medianAccuracy > 0) ? topicStats?.medianAccuracy*100*1.5 : 0)}%`
                                }}
                                title={`${topicChoice}: ${((topicStats?.medianAccuracy !== undefined && topicStats?.medianAccuracy > 0) ? topicStats?.medianAccuracy : 0)*100}% accuracy`}
                            >{((topicStats?.medianAccuracy !== undefined && topicStats?.medianAccuracy > 0) ? topicStats?.medianAccuracy*100 + '%' : '')}</div>
                        </div>
                        <span className="text-[10px] text-gray-500 leading-none">Median Accuracy</span>
                    </div> 
                    {/*
                    <div className="flex-1 min-w-0 flex flex-col items-center gap-1">
                        <div className="w-1/2 h-14 flex items-end">
                            <div className={`w-full rounded-t text-white text-center text-sm
                                ${topicStats?.medianAccuracy !== undefined ? (topicStats?.medianAccuracy > 0  ? "bg-blue-500" : "bg-gray-300") : "bg-gray-300"}`}
                                style={{ height: `${Math.max(8, (topicStats?.medianAccuracy !== undefined && topicStats?.medianAccuracy > 0) ? topicStats?.medianAccuracy*100 : 0)}%`
                                }}
                                title={`${topicChoice}: ${((topicStats?.medianAccuracy !== undefined && topicStats?.medianAccuracy > 0) ? topicStats?.medianAccuracy : 0)*100}% accuracy`}
                            >{((topicStats?.medianAccuracy !== undefined && topicStats?.medianAccuracy > 0) ? topicStats?.medianAccuracy : 0)*100}%</div>
                        </div>
                        <span className="text-[10px] text-gray-500 leading-none">Median Accuracy</span>
                    </div>
                    */}
                </div>
            )
        
    }

    const getStatisticsGrid = () => {
        return (
            <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-gray-50 p-3 border border-gray-200">
                    <p className="text-xs text-gray-500">Median Elapsed Time</p>
                    <p className="text-xl font-bold text-gray-900">{topicStats?.medianElapsedTime}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 border border-gray-200">
                    <p className="text-xs text-gray-500">Questions Completed</p>
                    <p className="text-xl font-bold text-gray-900">{topicStats?.responseCount}</p>
                </div>
            </div>
        )
    }

    const getCheckedQuestions = (questionID: number) => {
        for (let i = 0; i < checkQuestions.length; i++)
        {
            if(questionID === checkQuestions[i].questionID)
                return checkQuestions[i].isChecked;
        }
        return false;
    }

    const getQuestionStatisticsGrid = () => {
        //console.log(questionsAggregateStats.length)
        /*
        const questionStats: StatData = ({

        });
        */

        return questionStats?.responseCount !== undefined && questionStats?.responseCount > 0 ? 
        (
            <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-gray-50 p-3 border border-gray-200">
                    <p className="text-xs text-gray-500">Average Median Elapsed Time</p>
                    <p className="text-xl font-bold text-gray-900">{questionStats?.medianElapsedTime}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 border border-gray-200">
                    <p className="text-xs text-gray-500">Total Questions Completed</p>
                    <p className="text-xl font-bold text-gray-900">{questionStats?.responseCount}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 border border-gray-200">
                    <p className="text-xs text-gray-500">Average Median Accuracy</p>
                    <p className="text-xl font-bold text-gray-900">{questionStats?.medianAccuracy == undefined ? 0 : questionStats?.medianAccuracy *100}%</p>
                </div>
            </div>
        ) : (
            <div className="mt-3 flex text-center justify-center py-10">
                <p className="text-xl font-bold text-gray-900">No Question Responses To Show!</p>
            </div>
        );
    }

    return (
        <Layout>
            <div className="bg-gray-100 py-8 px-4">
                <div
                    className="max-w-6xl mx-auto bg-gray-50 rounded-lg shadow-md border border-gray-200 p-4 sm:p-8 md:p-10 space-y-6"
                    style={backgroundStyle}
                >

                    <div className="flex items-center gap-3 mb-6">
                        <div>
                            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Statistics</h1>
                        </div>
                    </div>

                    {loading && (
                        <div className="rounded-xl border border-gray-200 bg-white p-4 text-gray-600">
                            Loading data...
                        </div>
                    )}

                    {!loading && (
                    <div className="flex justify-between items-center w-full">
                        <h2 className="text-lg sm:text-xl font-bold text-gray-600">Topic Stats</h2>
                        <div>
                            <span className="pr-2 text-lg text-gray-900 font-bold">Topic: </span>
                            <select 
                                value={topicChoice}
                                className="border border-gray-300 rounded-lg px-3 py-2 text-md text-gray-700 bg-gray-100"
                                onChange={(event) => {
                                    let topic: string = event.target.value as string;
                                    setTopicChoice(topic);
                                    resolveTopicData(topic);
                                }}>
                                <option key='0' value="All">All</option>
                                {ALL_TOPICS.map((topic, index) => (
                                    <option key={index+1} value={topic}>{topic}</option>
                                ))};
                            </select>
                        </div>
                    </div>
                    )}

                    {!loading && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                        <section className="rounded-xl border border-gray-200 bg-white p-5">
                            <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Percentages</p>

                            {getPercentageGraphs()}

                        </section>
                        <section className="rounded-xl border border-gray-200 bg-white p-5">
                             <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Statistics</p>
                             {getStatisticsGrid()}
                        </section>
                    </div>
                    )}

                    {!loading && (
                    <div className="flex justify-between items-center w-full">
                        <h2 className="text-lg sm:text-xl font-bold text-gray-600">Question Stats</h2>
                    </div>
                    )}

                    {!loading && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                        <section className="rounded-xl border border-gray-200 bg-white p-5">
                            <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Statistics</p>
                            {getQuestionStatisticsGrid()}
                        </section>
                        <section className="rounded-xl border border-gray-200 bg-white p-5 max-h-80 overflow-auto">
                            <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Question Select</p>
                            {publishedQuestions.map((question) => (
                                <div key={question.id} className="flex mt-3 gap-3 rounded-lg border border-gray-300 items-center justify-between px-4 py-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="min-w-0">
                                            <p className="text-sm sm:text-base text-gray-900 truncate pb-1">
                                                Question #{question.id}
                                            </p>
                                            <p className="text-xs text-gray-500 truncate">
                                                {question.section} • {question.category} • {question.subcategory}
                                            </p>
                                            <p className="text-xs text-gray-500 truncate">
                                                Type: {question.questionType}
                                            </p>
                                        </div>
                                    </div>
                                    <input className="mr-4 w-5 h-5" 
                                        id="this"
                                        type="checkbox"
                                        checked={getCheckedQuestions(question.id)}
                                        onChange={(e) => {
                                            updateCheckQuestions(question.id, e.target.checked)

                                        }}
                                    >

                                    </input>
                                </div>
                            ))}
                        </section>
                    </div>
                    )}

                </div>
            </div>
        </Layout>
    );
};



export default ProfessorStatisticsPage;
/*
className={`w-full rounded-t ${topicStats?.medianAccuracy !== null ? (topicStats.medianAccuracy > 0  ? "bg-blue-500" : "bg-gray-300") : "bg-gray-300"}`}
    style={{ height: `${Math.max(8, topicStats?.medianAccuracy)}%` }}
    title={`${day.label}: ${day.attempts} attempts, ${accuracy}% accuracy`}

*/


