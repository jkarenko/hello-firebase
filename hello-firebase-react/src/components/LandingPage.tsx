interface LandingPageProps {
  handleLogin: () => void;
}

const LandingPage = ({ handleLogin }: LandingPageProps) => {
  return (
    <div className="min-h-screen">
      <section className="bg-gradient-to-br from-blue-600 to-blue-800 text-white py-24 px-8 text-center">
        <h1 className="text-5xl font-bold mb-4">Echoherence</h1>
        <p className="text-xl max-w-2xl mx-auto mb-8">
          The ultimate collaborative audio project management system. Share, version, and perfect your audio projects together.
        </p>
        <button 
          onClick={handleLogin}
          className="inline-block bg-white text-blue-600 px-8 py-4 rounded-lg font-semibold transition transform hover:-translate-y-0.5"
        >
          Start Collaborating
        </button>
      </section>

      <div className="h-[150px] bg-[url('data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 1440 320\'%3E%3Cpath fill=\'%232563eb\' fill-opacity=\'1\' d=\'M0,96L48,112C96,128,192,160,288,160C384,160,480,128,576,112C672,96,768,96,864,112C960,128,1056,160,1152,160C1248,160,1344,128,1392,112L1440,96L1440,0L1392,0C1344,0,1248,0,1152,0C1056,0,960,0,864,0C768,0,672,0,576,0C480,0,384,0,288,0C192,0,96,0,48,0L0,0Z\'%3E%3C/path%3E%3C/svg%3E')] bg-cover -mt-[150px]" />

      <section className="max-w-7xl mx-auto px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mt-12">
          <div className="bg-white p-8 rounded-xl shadow-sm">
            <h3 className="text-blue-600 text-xl font-semibold mb-4">Seamless Collaboration</h3>
            <p className="text-gray-600">
              Work together in real-time with role-based permissions and instant updates. Share projects easily with configurable invite links.
            </p>
          </div>

          <div className="bg-white p-8 rounded-xl shadow-sm">
            <h3 className="text-blue-600 text-xl font-semibold mb-4">Version Control</h3>
            <p className="text-gray-600">
              Keep track of every change with comprehensive version control. Switch between versions instantly while preserving playback position.
            </p>
          </div>

          <div className="bg-white p-8 rounded-xl shadow-sm">
            <h3 className="text-blue-600 text-xl font-semibold mb-4">Advanced Audio Player</h3>
            <p className="text-gray-600">
              Experience smooth playback with background pre-caching and intelligent browser caching for optimal performance.
            </p>
          </div>

          <div className="bg-white p-8 rounded-xl shadow-sm">
            <h3 className="text-blue-600 text-xl font-semibold mb-4">Interactive Comments</h3>
            <p className="text-gray-600">
              Discuss and refine your projects with thread-based comments. Track resolution status and receive real-time updates.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage; 
