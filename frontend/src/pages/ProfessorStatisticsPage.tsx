// For Professors to view the statistics on questions

import React, { useCallback, useEffect, useState, useMemo, useRef } from "react";
import api from "../api";

interface SubcategoryBreakdown
{
    medianAccuracy?:        number | null;
    medianElapsedTime?:     number | null;
    responseCount:          number;
}

interface AggregateStatsResponse
{
    medianAccuracy?:        number | null;
    medianElapsedTime?:     number | null;
    responseCount:          number;
    subcategoryBreakdown:   SubcategoryBreakdown[];
}









const ProfessorStatisticsPage: React.FC = () => 
{

    const [loading, setLoading]       = useState(false);
    const [error, setError]           = useState<string | null>(null);



    const fetchAggergateStats = () => {

    }

    const fetchQuestionAggregateStats = () => [

    ]


    return (
        <div>
            Hiya
        </div>
    );
};

export default ProfessorStatisticsPage;



