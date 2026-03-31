// For Professors to view the statistics on questions

import React, { useCallback, useEffect, useState, useMemo, useRef } from "react";
import api from "../api";
import Layout from "../components/Layout";
import { ALL_TOPICS, formatSubcategoryLabel } from "../utils/topicLabels"
import { RawQuestion} from '../models';
import { getBackgroundUrlByItemName } from "../utils/storeCosmetics";
import { useUserCustomizationStore, userCustomizationStore } from "../stores/userCustomizationStore";
import parse from "html-react-parser";
import DOMPurify from "dompurify";
import { ChevronLeft, ChevronRight, Eye } from "lucide-react";

interface Pagination {
    page:               number;
    pageSize:           number;
    totalQuestions:     number;
    totalPages:         number;
}

interface TopicQuestionList
{   questions: {
        [key: string]:      RawQuestion[];
    }
    pagination: Pagination;
}


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

interface ProfessorQuestionItem {
  id: number;
  title: string;
  category: string;
  subcategory: string;
  type: string;  
}

const formatRatioPercentage = (value?: number | null): string => {
        const normalizedValue = typeof value === "number" && Number.isFinite(value) ? value : 0;
        return `${Math.round(normalizedValue * 100)}%`;
};

const ProfessorStatisticsPage: React.FC = () => 
{
    const removeHtmlTags = /(<([^>]+)>)/gi;

    const scrollRef = useRef<HTMLInputElement | null>(null);
    // State to store the current scroll position
    const [, setScrollPos] = useState(0);

    const [questions, setQuestions] = useState<ProfessorQuestionItem[]>([]);
    const [questionsPagination, setQuestionsPagination] = useState<Pagination>();

    const [checkQuestions, setCheckQuestions] = useState<CheckQuestion[]>([]);

    const [aggregateStats, setAggregateStats] = useState<AggregateStatsResponse>();
    const [questionsAggregateStats, setQuestionsAggregateStats] = useState<AggregateStatsByQuestionResponse[]>([]);
    const [topicStats, setTopicStats]   = useState<StatData | null>();
    const [questionStats, setQuestionStats] = useState<StatData>();

    const [loading, setLoading]       = useState(false);
    const [listLoading, setListLoading] = useState(false);
    const [, setError]           = useState<string | null>(null);

    const [topicChoice, setTopicChoice] = useState<string>("All");
    const [topicChoice2, setTopicChoice2] = useState<string>("InputOutput");

    const { equippedItems } = useUserCustomizationStore();

    const [previewQuestion, setPreviewQuestion] = useState<RawQuestion | null>(null);
    const [, setPreviewLoadingId] = useState<number | null>(null);
    const [previewError, setPreviewError] = useState("");

    const fetchAggregateStats = useCallback( async () => 
    {
        setLoading(true);
        setError(null);
        const token = localStorage.getItem('token');

        try
        {
            const response = await api.get<AggregateStatsResponse>(`/api/stats/aggregate`,
            {
                headers: { 'Authorization': `Bearer ${token}` },
            });

            setAggregateStats(response.data);
        }
        catch
        {
            setError("Failed to load aggregate stats. Please try again.");
        }
        finally
        {
            setLoading(false);
        }
    }, []);

    const fetchQuestionAggregateStats =  useCallback(async (checkQuestions: CheckQuestion[]) => 
    {   
        if (checkQuestions.length < 1)
            return;

        setError(null);
        const token = localStorage.getItem('token');

        try
        {
            const temp: AggregateStatsByQuestionResponse[] = [];

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

            setQuestionsAggregateStats(temp);
        }
        catch
        {
            setError("Failed to load Question Stats. Please try again.");
        }
    }, []);

    const fetchQuestionList = (async (page: number) => {

        setListLoading(true);
        setError(null);
        const token = localStorage.getItem('token');

        try
        {
            
            const response = await api.get<TopicQuestionList>(
                `/api/problems?page=${page}&${topicChoice2.toLowerCase() === "My Questions".toLowerCase() ? "mine=true" : `subcategory=${topicChoice2}`}`,
            {
                headers: { 'Authorization': `Bearer ${token}` },
            });


            setQuestionsPagination(response.data.pagination);

            
            const converted: ProfessorQuestionItem[] = [];
            
            
            if(topicChoice2.toLowerCase() === "My Questions".toLowerCase())
            {

                ALL_TOPICS.map((topic) => {
                    if(response.data.questions[topic] !== undefined && response.data.questions[topic] !== null)
                    {

                        for(let k = 0; k < response.data.questions[topic].length; k++)
                        {
                            converted.push({
                                id: response.data.questions[topic][k].ID,
                                title: response.data.questions[topic][k].QUESTION_TEXT.replace(removeHtmlTags, ""),
                                category: response.data.questions[topic][k].CATEGORY,
                                subcategory: response.data.questions[topic][k].SUBCATEGORY,
                                type: response.data.questions[topic][k].TYPE
                            })
                        }
                    }
                })
            } else {

                for(let i = 0; i < response.data.questions[topicChoice2].length; i++) {
                
                    converted.push({
                        id: response.data.questions[topicChoice2][i].ID,
                        title: response.data.questions[topicChoice2][i].QUESTION_TEXT.replace(removeHtmlTags, ""),
                        category: response.data.questions[topicChoice2][i].CATEGORY,
                        subcategory: response.data.questions[topicChoice2][i].SUBCATEGORY,
                        type: response.data.questions[topicChoice2][i].TYPE
                    })
                }   
            }

            setQuestions(converted);
        }
        catch
        {
            setError("Failed to load aggregate stats. Please try again.");
        }
        finally
        {
            setListLoading(false);
        }
    });

    useEffect(() => {
        fetchAggregateStats();
    }, [fetchAggregateStats])

    useEffect(() => {
        fetchQuestionAggregateStats(checkQuestions);
        
    }, [checkQuestions, questions, fetchQuestionAggregateStats])

    useEffect(() => {
        fetchQuestionList(questionsPagination?.page == undefined ? 1 : questionsPagination?.page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [topicChoice2])

    useEffect(() => {
        resolveTopicData('All');
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [aggregateStats])


    useEffect(() => {
        const temp: CheckQuestion[] = [];
        
        for (let i = 0; i < questions.length; i++)
        {
            temp.push({questionID: questions[i].id, isChecked: false})
        }

        setCheckQuestions(temp);

    }, [questions])

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

        if (topicChoice.toLowerCase() === "All".toLowerCase()){
            const topicData: StatData = {
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
                    const topicData: StatData = {
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
        const temp: CheckQuestion[] = [];
        checkQuestions.map((checkQuestion) => (
            checkQuestion.questionID === id 
                ?   temp.push({questionID: checkQuestion.questionID, isChecked: checked})
                :   temp.push({questionID: checkQuestion.questionID, isChecked: checkQuestion.isChecked})
        ))

        setCheckQuestions(temp);
    }

    //question
    const updateQuestionStats = (questionsAggregateStats: AggregateStatsByQuestionResponse[]) => {

        if (questionsAggregateStats.length < 1){
            return;
        }
        
        const length = questionsAggregateStats.length;
        let totalMedianElapsedTime = 0;
        let totalMedianAccuracy = 0;
        let totalQuestionsCompleted = 0;

        questionsAggregateStats.map((question) => {
            totalMedianAccuracy += question?.medianAccuracy == undefined || question?.medianAccuracy == null ? 0 : question?.medianAccuracy;
            totalMedianElapsedTime += question?.medianElapsedTime == undefined || question?.medianElapsedTime == null ? 0 : question?.medianElapsedTime;
            totalQuestionsCompleted += question?.responseCount == undefined || question?.responseCount == null ? 0 : question?.responseCount;
        })

        setQuestionStats({
            medianAccuracy: Math.round(totalMedianAccuracy*100 / length),
            medianElapsedTime: Math.round(totalMedianElapsedTime / length),
            responseCount: totalQuestionsCompleted
        })

    }

    const getPercentageGraphs = () => {

            const topicMedianAccuracy = topicStats?.medianAccuracy;
            const hasMedianAccuracy = typeof topicMedianAccuracy === "number" && topicMedianAccuracy > 0;
            const displayMedianAccuracy = hasMedianAccuracy ? formatRatioPercentage(topicMedianAccuracy) : "";
            const medianAccuracyTooltip = `${topicChoice}: ${formatRatioPercentage(topicMedianAccuracy)} accuracy`;

        
            return (
                <div className="flex items-end gap-2 h-30">
                    <div className="flex-1 min-w-0 flex flex-col items-center gap-1">
                        <div className="w-1/4 h-14 flex items-end">
                            <div className={`w-full rounded-t text-white text-center text-sm
                                ${topicStats?.medianAccuracy !== undefined ? (topicStats?.medianAccuracy > 0  ? "bg-blue-500" : "bg-gray-300") : "bg-gray-300"}`}
                                style={{ height: `${Math.max(12, hasMedianAccuracy ? topicMedianAccuracy*100*1.5 : 0)}%`
                                }}
                                title={medianAccuracyTooltip}
                            >{displayMedianAccuracy}</div>
                        </div>
                        <span className="text-[10px] text-gray-500 leading-none">Median Performance</span>
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
            <div className="mt-3 flex flex-wrap gap-3">
                <div className="min-w-[220px] flex-1 rounded-lg bg-gray-50 p-3 border border-gray-200">
                    <p className="text-xs text-gray-500">Median Elapsed Time</p>
                    <p className="text-xl font-bold text-gray-900">{topicStats?.medianElapsedTime}s</p>
                </div>
                <div className="min-w-[220px] flex-1 rounded-lg bg-gray-50 p-3 border border-gray-200">
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
        const length = checkQuestions.filter((question) => {return question.isChecked}).length
        const moreThanOneChecked: boolean =  length > 1
        const noneChecked: boolean = length < 1
        

        return questionStats?.responseCount !== undefined && questionStats?.responseCount > 0 && !noneChecked ?
        (
            <div className="mt-3 flex flex-wrap gap-3">
                <div className="min-w-[220px] flex-1 rounded-lg bg-gray-50 p-3 border border-gray-200">
                    <p className="text-xs text-gray-500">{moreThanOneChecked ? 'Average Median Elapsed Time' : 'Median Elapsed Time'}</p>
                    <p className="text-xl font-bold text-gray-900">{questionStats?.medianElapsedTime}s</p>
                </div>
                <div className="min-w-[220px] flex-1 rounded-lg bg-gray-50 p-3 border border-gray-200">
                    <p className="text-xs text-gray-500">Total Questions Completed</p>
                    <p className="text-xl font-bold text-gray-900">{questionStats?.responseCount}</p>
                </div>
                <div className="min-w-[220px] flex-1 rounded-lg bg-gray-50 p-3 border border-gray-200">
                    <p className="text-xs text-gray-500">{moreThanOneChecked ? 'Average Median Performance' : 'Median Perfomance'}</p>
                    <p className="text-xl font-bold text-gray-900">{questionStats?.medianAccuracy == undefined ? 0 : questionStats?.medianAccuracy}%</p>
                </div>
            </div>
        ) : (
            <div className="mt-3 flex text-center justify-center py-10">
                <p className="text-xl font-semibold text-gray-900">Select a question by checking the box to see specific statistics.</p>
            </div>
        );
    }

    //question
    const isSelected = (id: number) => {
        return checkQuestions.filter((question) => {return question.questionID === id && question.isChecked}).length < 1 
            ?  false
            :  true;
    }

    /* Might Come Back to later: Saving scroll position in checklist would make for nice polish {currently not working}

    // Effect to update scrollPos state when the user scrolls
    useEffect(() => {
        const handleScroll = () => setScrollPos(window.scrollY);

        // Adding scroll event listener
        window.addEventListener('scroll', handleScroll);

        // Cleanup function to remove the event listener
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Effect to restore scroll position on component mount
    useEffect(() => {
        // Scroll to the saved position
        window.scrollTo(0, scrollPos);
    }, [scrollPos]);
    
    // Effect to update scrollPos state when the user scrolls
    useEffect(() => {
        //const handleScroll = () => setScrollPos(window.scrollY);

        
        if (scrollRef !== null && scrollRef.current !== null) {
            // Adding scroll event listener
            scrollRef.current.addEventListener('scroll', () => {
                setScrollPos(scrollRef?.current?.scrollHeight == undefined ? 0 : scrollRef?.current?.scrollTop)
            })
            console.log(scrollRef?.current?.scrollHeight == undefined ? 0 : scrollRef?.current?.scrollTop)

            // Cleanup function to remove the event listener
            return () => window.removeEventListener('scroll', () => {
                setScrollPos(scrollRef?.current?.scrollHeight == undefined ? 0 : scrollRef?.current?.scrollHeight)
            });
        }
    }, [checkQuestions]);

    
    // Effect to restore scroll position on component mount
    useEffect(() => {
        
        if (scrollRef !== null && scrollRef.current !== null) {
            // Scroll to the saved position
            scrollRef.current.scrollTo(0, scrollPos);
        }
    }, [scrollPos, checkQuestions]);


    // Create a ref to reference the scrollable container
    //const containerRef = useRef(null);

    // Function to scroll to the bottom of the container
    const scrollToBottom = () => {
        // Scroll to the bottom of the container by setting scrollTop to the container's scrollHeight
        if (scrollRef !== null && scrollRef.current !== null) {
            scrollRef.current.addEventListener('scroll', () => {setScrollPos(scrollRef?.current?.scrollHeight == undefined ? 0 : scrollRef?.current?.scrollHeight)})
            //scrollRef.current.scrollTop = scrollRef.current?.scrollHeight;
        }
    };
    */

    const handlePreviewQuestion = async (questionId: number) => {
    setPreviewError("");
    setPreviewLoadingId(questionId);

        try {
        const response = await api.get<RawQuestion>(`/api/admin/problems/${questionId}`);
        setPreviewQuestion(response.data);
        } catch {
        setPreviewError("Failed to load question preview.");
        } finally {
        setPreviewLoadingId(null);
        }
    };

    const normalizeQuestionType = (questionType?: string): string => {
        const normalized = (questionType || "").trim();
        switch (normalized.toLowerCase()) {
            case "multiple choice":
            case "multiple_choice":
            return "Multiple Choice";
            case "fill in the blanks":
            case "fill_in_blank":
            return "Fill in the Blanks";
            case "select all that apply":
            case "select_all_that_apply":
            return "Select All That Apply";
            case "ranked choice":
            case "ranked_choice":
            return "Ranked Choice";
            case "drag and drop":
            case "drag_and_drop":
            return "Drag and Drop";
            default:
            return "Multiple Choice";
        }
    };
    const parseAnswerCorrectness = (value: unknown): boolean => {
        if (typeof value === "boolean") return value;
        if (typeof value === "number") return value === 1;
        if (typeof value === "string") {
            const normalized = value.trim().toLowerCase();
            return normalized === "1" || normalized === "true";
        }
        return false;
    };
    const previewQuestionType = normalizeQuestionType(previewQuestion?.TYPE);
    const previewQuestionHtml = useMemo(
        () => DOMPurify.sanitize(String(previewQuestion?.QUESTION_TEXT || "")),
        [previewQuestion?.QUESTION_TEXT]
    );
    const previewAnswers = useMemo(() => {
    if (!Array.isArray(previewQuestion?.answers)) {
        return [];
    }

    return [...previewQuestion.answers]
        .map((answer, index) => {
        const parsedRank = Number(answer.RANK);
        return {
            text: String(answer.TEXT || ""),
            isCorrect:
            previewQuestionType === "Ranked Choice" || previewQuestionType === "Drag and Drop"
                ? true
                : parseAnswerCorrectness(answer.IS_CORRECT_ANSWER),
            rank: Number.isFinite(parsedRank) && parsedRank > 0 ? parsedRank : index + 1,
            placement: String(answer.PLACEMENT || "").trim(),
        };
        })
        .filter((answer) => answer.text.trim().length > 0)
        .sort((first, second) => first.rank - second.rank);
    }, [previewQuestion?.answers, previewQuestionType]);

    return (
        <Layout>
            <div className="bg-gray-100 py-8 px-4">
                <div
                    className="max-w-6xl mx-auto bg-gray-50 rounded-lg shadow-md border border-gray-200 p-4 sm:p-8 md:p-10 space-y-6"
                    style={backgroundStyle}
                >

                    {/*Header*/}
                    <div className="flex items-center gap-3 mb-6">
                        <div>
                            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Statistics</h1>
                        </div>
                    </div>

                    {loading && questions.length === 0 && listLoading === false && (
                        <div className="rounded-xl border border-gray-200 bg-white p-4 text-gray-600">
                            Loading data...
                        </div>
                    )}

                    {/*Aggregate Stats*/}
                    {aggregateStats !== undefined && (
                    <div className="flex justify-between items-center w-full">
                        <h2 className="text-lg sm:text-xl font-bold text-gray-600">Topic Stats</h2>
                        <div>
                            <span className="pr-2 text-lg text-gray-900 font-bold">Topic: </span>
                            <select 
                                value={topicChoice}
                                className="border border-gray-300 rounded-lg px-3 py-2 text-md text-gray-700 bg-gray-100"
                                onChange={(event) => {
                                    const topic: string = event.target.value as string;
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

                    {aggregateStats !== undefined && (
                    <div className={`grid grid-cols-1 lg:grid-cols-2 gap-4 items-start`}>
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

                    {/*Question Stats*/}
                    {aggregateStats !== undefined && (
                    <div className="flex justify-between items-center w-full">
                        <h2 className="text-lg sm:text-xl font-bold text-gray-600">Question Stats</h2>

                        <select 
                            value={topicChoice2}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-md text-gray-700 bg-gray-100"
                            onChange={(event) => {
                                const topic: string = event.target.value as string;
                                setTopicChoice2(topic);

                            }}>
                            <option key='0' value="My Questions">My Questions</option>
                            {ALL_TOPICS.map((topic, index) => (
                                <option key={index+1} value={topic}>{formatSubcategoryLabel(topic)}</option>
                            ))};
                        </select>
                    </div>
                    )}

                    {(questions.length > 0 || !listLoading) && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                        <section className="rounded-xl border border-gray-200 bg-white p-5">
                            <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Statistics</p>
                            {getQuestionStatisticsGrid()}
                        </section>
                        <section className={`rounded-xl border border-gray-200 bg-white pr-1 p-5 ${questionsPagination?.totalPages !== undefined && questionsPagination?.totalPages > 1 ? `max-h-120` : `max-h-100`}`}>
                            <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-3">Question Select</p>
                            <div className={`w-full h-full max-h-85 overflow-auto pr-4 mb-3 border-y border-gray-300 transition-opacity ${listLoading ? 'opacity-50' : 'opacity-100'}`}>
                            {questions.map((question) => (
                                <div key={question.id} className={`flex mt-2 mb-2 gap-3 rounded-lg items-start justify-between px-4 py-3 
                                    ${isSelected(question.id) ?  `border bg-amber-100 border-amber-400` : `border bg-gray-50 border-gray-300`}`}>
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="min-w-0">
                                            <p className="text-sm sm:text-base text-gray-900 truncate pb-1">
                                                {question.title}
                                            </p>
                                            <p className="text-xs text-gray-500 truncate">
                                                #{question.id} • {question.category} / {question.subcategory}
                                            </p>
                                            <p className="text-xs text-gray-500 truncate">
                                                Type: {question.type}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex shrink-0 flex-col items-end gap-3">
                                        <button
                                            type="button"
                                            onClick={() => handlePreviewQuestion(question.id)}
                                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700 transition hover:bg-blue-100"
                                            aria-label={`View question ${question.id}`}
                                            title="View question preview"
                                        >
                                            <Eye size={18} />
                                        </button>
                                        <input className="mr-2 w-5 h-5 min-w-5 min-h-5 hover:cursor-pointer accent-amber-500 rounded-lg p-3" 
                                            type="checkbox"
                                            checked={getCheckedQuestions(question.id)}
                                            aria-label={`Select question ${question.id}`}
                                            ref={scrollRef}
                                            onChange={(e) => {
                                                updateCheckQuestions(question.id, e.target.checked)
                                                setScrollPos(scrollRef.current?scrollY : 0)
                                            }}
                                        >
                                        </input>
                                    </div>
                                </div>
                            ))}
                            
                            </div>
                            {/* Pagination */}
                            {questionsPagination !== undefined && questionsPagination.totalPages > 1 && (
                                <div className="flex w-full h-10 relative items-end justify-center">
                                    <div className="flex w-full gap-10 items-center justify-center absolute">
                                        <button
                                            disabled={questionsPagination.page <= 1}
                                            onClick={() => {
                                                fetchQuestionList(questionsPagination.page-1);
                                            }}
                                            className= "flex gap-1 px-3 py-2 items-center rounded-lg text-sm text-gray-600 enabled:hover:bg-gray-200 ${} disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                        >
                                            <ChevronLeft size={16} />
                                            Prev
                                        </button>
                                            <span className="text-sm text-gray-500">
                                                {listLoading ? `Loading page ${questionsPagination.page}...` : `Page ${questionsPagination.page} of ${questionsPagination.totalPages}`}
                                            </span>
                                        <button
                                            disabled={questionsPagination.page >= questionsPagination.totalPages}
                                            onClick={() => {
                                                fetchQuestionList(questionsPagination.page+1);
                                            }}
                                            className= "flex gap-1 px-3 py-2 items-center rounded-lg text-sm text-gray-600 enabled:hover:bg-gray-200 ${} disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                        >
                                            Next
                                            <ChevronRight size={16} />
                                        </button>
                                    </div>
                                </div>
                            )}
                           
                        </section>
                    </div>
                    )}

                </div>

                {/*Question Preview Section: Credit to Dahlia*/}
                {previewError && (
                    <div className="mt-4 rounded-lg border border-red-300 bg-red-50 text-red-700 px-4 py-3 text-sm">
                    {previewError}
                    </div>
                )}
                {previewQuestion && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                        onClick={() => setPreviewQuestion(null)}
                    >
                        <div
                            className="w-full max-w-3xl rounded-xl bg-white shadow-lg"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="flex items-center justify-between border-b border-blue-200 bg-blue-50 px-5 py-4 rounded-xl">
                                <div>
                                    <h2 className="text-lg font-semibold text-blue-900">Question Preview</h2>
                                    <p className="text-xs text-gray-500">#{previewQuestion.ID} • {previewQuestion.CATEGORY || "General"} / {previewQuestion.SUBCATEGORY || "General"}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setPreviewQuestion(null)}
                                    className="px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50"
                                >
                                    Close
                                </button>
                                </div>
                                <div className="max-h-[70vh] overflow-y-auto px-5 py-4 bg-gray-50">
                                <div className="max-w-3xl mx-auto px-4 sm:px-6 md:px-8 py-6 bg-white rounded-lg border border-gray-200">
                                    <div className="flex flex-col sm:flex-row justify-between mb-2 text-sm sm:text-lg md:text-xl">
                                    <p className="text-gray-600">Section {previewQuestion.SECTION || "—"}</p>
                                    <p className="font-medium">Question 1 of 1</p>
                                    </div>
                
                                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                                    {previewQuestion.CATEGORY || "Category"} <span className="text-yellow-600">&gt;</span>{" "}
                                    {previewQuestion.SUBCATEGORY || "Subcategory"}
                                    <span className="block text-sm sm:text-base md:text-lg text-gray-500 font-normal mt-1 sm:mt-0">
                                        (Credit: {previewQuestion.AUTHOR_EXAM_ID || "Professor"})
                                    </span>
                                    </h1>
                
                                    <h2 className="text-lg font-semibold mb-2">Question 1 of 1</h2>
                
                                    <div className="text-base sm:text-lg md:text-xl font-medium mb-4 text-gray-800 leading-relaxed whitespace-pre-wrap [&_pre]:bg-gray-100 [&_pre]:border [&_pre]:border-gray-200 [&_pre]:rounded-md [&_pre]:p-3 [&_pre]:overflow-x-auto [&_code]:font-mono [&_code]:text-sm">
                                    {previewQuestion.QUESTION_TEXT?.trim().length
                                        ? parse(previewQuestionHtml)
                                        : <span className="text-gray-500">Nothing to preview yet.</span>}
                                    </div>
                
                                    {(previewQuestionType === "Multiple Choice" || previewQuestionType === "Select All That Apply") && (
                                    <div className="space-y-3 mb-2">
                                        {previewAnswers.map((answer, index) => (
                                        <label
                                            key={`${answer.rank}-${index}`}
                                            className="block p-3 sm:p-4 rounded-lg border bg-white border-gray-300 text-sm sm:text-base md:text-lg"
                                        >
                                            <input
                                            type={previewQuestionType === "Select All That Apply" ? "checkbox" : "radio"}
                                            defaultChecked={answer.isCorrect}
                                            disabled
                                            className="mr-3"
                                            />
                                            {answer.text}
                                        </label>
                                        ))}
                                    </div>
                                    )}
                
                                    {previewQuestionType === "Fill in the Blanks" && (
                                    <div className="mb-2">
                                        <label className="block text-sm sm:text-base font-medium text-gray-700 mb-2">Your Answer:</label>
                                        <input
                                        type="text"
                                        disabled
                                        placeholder="Type your answer here..."
                                        className="w-full p-3 sm:p-4 rounded-lg border text-sm sm:text-base md:text-lg bg-white border-gray-300"
                                        />
                                    </div>
                                    )}
                
                                    {previewQuestionType === "Ranked Choice" && (
                                    <div className="space-y-2 mb-2">
                                        {previewAnswers.map((answer, index) => (
                                        <div key={`${answer.rank}-${index}`} className="flex items-center gap-3 p-3 rounded-lg border border-gray-300 bg-white">
                                            <span className="text-sm font-semibold text-gray-600 w-6">{index + 1}.</span>
                                            <span className="text-sm sm:text-base md:text-lg text-gray-800">{answer.text}</span>
                                        </div>
                                        ))}
                                    </div>
                                    )}
                
                                    {previewQuestionType === "Drag and Drop" && (
                                    <div className="space-y-2 mb-2">
                                        {previewAnswers.map((answer, index) => (
                                        <div key={`${answer.rank}-${index}`} className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border border-gray-300 bg-white">
                                            <span className="text-sm sm:text-base md:text-lg text-gray-800">{answer.text}</span>
                                            <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-1 rounded">
                                            {answer.placement || "Unassigned"}
                                            </span>
                                        </div>
                                        ))}
                                    </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
};



export default ProfessorStatisticsPage;


