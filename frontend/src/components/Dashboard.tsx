////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2025-2026
//  Author(s):     KnightWise Team
//  File:          Dashboard.tsx
//  Description:   Dashboard component.
//
//  Dependencies:  react
//
////////////////////////////////////////////////////////////////

import { useState, useEffect } from "react";

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

// set foundation exam date
// set the date of the Summer 2025 semester to first weeek Saturday: 2025/5/17
// TODO: Avoid having this be hard-coded
const targetDate = new Date("2025-05-17T00:00:00").getTime();

const Dashboard: React.FC = () => {

  // function: calculate timeleft
  const calculateTimeLeft = (): TimeLeft => {
    const now = Date.now();
    const difference = targetDate - now;

    if (difference <= 0)
    {
      return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    }

    return {
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / (1000 * 60)) % 60),
      seconds: Math.floor((difference / 1000) % 60),
    };
  };

  // store the remaining time
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(calculateTimeLeft());

  // update time per 1 sec
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const isExpired = ( 
                      timeLeft.days     === 0 &&
                      timeLeft.hours    === 0 &&
                      timeLeft.minutes  === 0 &&
                      timeLeft.seconds  === 0
                    )

  return (
    <div className="p-4 sm:p-10 md:p-20 flex flex-col items-center">
      {/* Display countdown if there's still time left */}
      {/* Otherwise, display special "yet to be updated" message */}
      { isExpired ? (
        <div className="bg-[#ffc904] shadow-lg rounded-xl p-4 sm:p-6 text-center mb-8 w-full max-w-4xl">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4">
          No Future Exams Scheduled Yet!
        </h2>
        <p className="text-lg sm:text-xl">
          The next Foundation Exam hasn't been scheduled yet. Check back for updates!
        </p>
      </div>
    ) : (
        <div className="bg-gray-200 shadow-lg rounded-xl p-4 sm:p-6 text-center mb-8 w-full max-w-4xl">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-semibold mb-4">
            The Foundation Exam is in...
          </h2>
          <div className="flex justify-center items-center flex-wrap gap-6 text-3xl sm:text-5xl md:text-6xl font-bold">
            <div className="text-gray-900">
              {timeLeft.days}
              <span className="block text-sm sm:text-base md:text-lg font-medium">
                DAYS
              </span>
            </div>
            <div className="text-gray-900">
              {timeLeft.hours}
              <span className="block text-sm sm:text-base md:text-lg font-medium">
                HOURS
              </span>
            </div>
            <div className="text-gray-900">
              {timeLeft.minutes}
              <span className="block text-sm sm:text-base md:text-lg font-medium">
                MINUTES
              </span>
            </div>
            <div className="text-gray-900">
              {timeLeft.seconds}
              <span className="block text-sm sm:text-base md:text-lg font-medium">
                SECONDS
              </span>
            </div>
          </div>
        </div>
      )}
      {/* guideline */}
      <div className="bg-gray-200 p-6 sm:p-10 rounded-lg shadow-md w-full max-w-4xl">
        <h3 className="text-2xl sm:text-4xl md:text-5xl text-center font-semibold mb-6">
          Foundation Exam Guideline
        </h3>
        <ul className="list-disc list-inside text-base sm:text-xl md:text-2xl text-gray-800 space-y-4">
          <li>
            <strong>Purpose:</strong> Required exam for 4000-level CS courses
          </li>
          <li>
            <strong>Eligibility:</strong> Students who passed COP 3502 (C or
            higher)
          </li>
          <li>
            <strong>Attempts:</strong> Max three attempts within one year
          </li>
          <li>
            <strong>Schedule:</strong> First Saturday of each semester
          </li>
          <li>
            <strong>Registration:</strong>{" "}
            <a
              href="https://www.cs.ucf.edu/registration/new/message.php"
              className="text-blue-700 underline font-semibold text-base sm:text-xl md:text-2xl"
            >
              Register here
            </a>
          </li>
          <li>
            <strong>Allowed Materials:</strong>{" "}
            <a
              href="https://www.cs.ucf.edu/wp-content/uploads/2019/08/FE-FormulaSheet.pdf"
              className="text-blue-700 underline font-semibold text-base sm:text-xl md:text-2xl"
            >
              Formula Sheet
            </a>
          </li>
          <li>
            <strong>Exam Day Rules:</strong>
          </li>
          <ul className="list-disc list-inside ml-6 sm:ml-8 text-base sm:text-xl md:text-2xl">
            <li>Bring valid ID</li>
            <li>No electronic devices</li>
            <li>Time limit enforced</li>
          </ul>
          <li>
            <strong>Passing Criteria:</strong> Typically 60% or higher
          </li>
          <li>
            <strong>More Info:</strong>{" "}
            <a
              href="https://www.cs.ucf.edu/ucf_section/foundation-exam/"
              className="text-blue-700 underline font-semibold text-base sm:text-xl md:text-2xl"
            >
              Official Site
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default Dashboard;
