import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import PageTitle from "../components/PageTitle";
import api from "../api";

const ProfessorApplyPage = () => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<"send" | "verify" | "submit" | null>(null);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const navigate = useNavigate();

  const nameRegex = /^[A-Za-z]{1,}$/;
  const usernameRegex = /^[A-Za-z\d]{5,}$/;
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{5,}$/;

  const handleSendOtp = async () => {
    if (isLoading) return;

    setIsLoading(true);
    setLoadingAction("send");
    try {
      await api.post("/api/auth/sendotp", {
        email,
        purpose: "signup",
      });
      setSuccessMessage("Verification email sent!");
      setError("");
    } catch {
      setError("Failed to send verification code. Please try again.");
      setSuccessMessage("");
    } finally {
      setIsLoading(false);
      setLoadingAction(null);
    }
  };

  const handleVerifyOtp = async () => {
    if (isLoading) return;

    setIsLoading(true);
    setLoadingAction("verify");
    try {
      await api.post("/api/auth/verify", {
        email,
        otp,
      });
      setIsVerified(true);
      setSuccessMessage("Email verified");
      setError("");
    } catch {
      setError("Verification failed. Please check your code and try again.");
      setSuccessMessage("");
    } finally {
      setIsLoading(false);
      setLoadingAction(null);
    }
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!nameRegex.test(firstName) || !nameRegex.test(lastName)) {
      setError("Name must be at least one letter");
      return;
    }

    if (!usernameRegex.test(username)) {
      setError("Username must be at least 5 characters (letters or numbers)");
      return;
    }

    if (!passwordRegex.test(password)) {
      setError("Password must be at least 5 characters with uppercase, lowercase, number, and special character");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!isVerified) {
      setError("Please verify your email with the code before submitting.");
      return;
    }

    setIsLoading(true);
    setLoadingAction("submit");
    try {
      const response = await api.post("/api/auth/professor-apply", {
        username,
        email,
        password,
        firstName,
        lastName,
      });

      setSuccessMessage(response.data.message || "Application submitted. Please allow up to 72 hours for review. You will be notified via email once a decision has been made.");
      setError("");
    } catch (err: unknown) {
      const message =
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof (err as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
          ? (err as { response?: { data?: { message?: string } } }).response!.data!.message!
          : "Failed to submit application. Please try again.";

      setError(message);
      setSuccessMessage("");
    } finally {
      setIsLoading(false);
      setLoadingAction(null);
    }
  };

  return (
    <div className="min-h-screen w-screen flex flex-col">
      <Header />
      <div className="flex flex-1 flex-col md:flex-row">
        <div className="hidden md:flex w-full md:w-1/2 flex-col items-center justify-center bg-gray-100">
          <PageTitle />
        </div>
        <div className="w-full md:w-1/2 flex items-center justify-center p-10">
          <div className="bg-gray-100 p-8 sm:p-12 rounded-xl shadow-lg w-full max-w-2xl">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-800 mb-2 text-center">
              Apply for a Professor Account
            </h1>
            <p className="text-sm sm:text-base text-gray-700 mb-6 text-center">
              In order to be approved you must be a professor for an accredited institution. Please provide accurate information for verification.
            </p>
            <p className="text-sm sm:text-base text-gray-700 mb-6 text-center">
              Submit your information below. Applications are reviewed before activation, please allow up to 72 hours for approval.
            </p>

            <form onSubmit={handleApply} className="space-y-4 w-full">
              <div className="flex items-center space-x-4">
                <label className="w-1/3 text-base sm:text-lg font-semibold text-gray-700">First Name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-2/3 px-4 py-3 text-sm sm:text-base border border-gray-300 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  required
                />
              </div>

              <div className="flex items-center space-x-4">
                <label className="w-1/3 text-base sm:text-lg font-semibold text-gray-700">Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-2/3 px-4 py-3 text-sm sm:text-base border border-gray-300 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  required
                />
              </div>

              <div className="flex items-center space-x-4">
                <label className="w-1/3 text-base sm:text-lg font-semibold text-gray-700">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-2/3 px-4 py-3 text-sm sm:text-base border border-gray-300 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  required
                />
              </div>

              <div className="flex items-center space-x-4">
                <label className="w-1/3 text-base sm:text-lg font-semibold text-gray-700">Email</label>
                <div className="w-2/3 flex space-x-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 text-sm sm:text-base border border-gray-300 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    required
                    disabled={isVerified}
                  />
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold px-4 py-2 rounded-lg transition"
                    disabled={isLoading || isVerified || !email}
                  >
                    {loadingAction === "send" ? "Sending..." : "Send Code"}
                  </button>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <label className="w-1/3 text-base sm:text-lg font-semibold text-gray-700">Enter OTP</label>
                <div className="w-2/3 flex space-x-2">
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="w-full px-4 py-3 text-sm sm:text-base border border-gray-300 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    placeholder="6-digit code"
                    disabled={isVerified}
                  />
                  <button
                    type="button"
                    onClick={handleVerifyOtp}
                    className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold px-4 py-2 rounded-lg transition"
                    disabled={isLoading || isVerified || otp.length !== 6}
                  >
                    {loadingAction === "verify" ? "Verifying..." : "Verify"}
                  </button>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <label className="w-1/3 text-base sm:text-lg font-semibold text-gray-700">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-2/3 px-4 py-3 text-sm sm:text-base border border-gray-300 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  required
                />
              </div>

              <div className="flex items-center space-x-4">
                <label className="w-1/3 text-base sm:text-lg font-semibold text-gray-700">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-2/3 px-4 py-3 text-sm sm:text-base border border-gray-300 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full bg-yellow-500 text-black text-lg font-bold py-3 rounded-xl shadow-lg hover:bg-yellow-600 transition"
                disabled={isLoading}
              >
                {loadingAction === "submit" ? "Submitting..." : "Submit Application"}
              </button>
            </form>

            <p className="text-sm sm:text-base text-gray-600 mt-4 text-center">
              <button
                onClick={() => navigate("/")}
                className="text-blue-500 hover:underline disabled:text-gray-400"
                disabled={isLoading}
              >
                {isLoading ? "Please wait..." : "Back to Sign In"}
              </button>
            </p>

            {error && <p className="text-red-500 text-center mt-4">{error}</p>}
            {successMessage && <p className="text-green-600 text-center mt-4">{successMessage}</p>}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ProfessorApplyPage;
