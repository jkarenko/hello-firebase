import { Card } from "./Card";
import { CardHeader } from "./CardHeader";
import { CardBody } from "./CardBody";

interface LandingPageProps {
  handleLogin: () => void;
}

const LandingPage = ({ handleLogin }: LandingPageProps) => {
  return (
    <div className="min-h-screen">
      <section className="bg-gradient-to-br from-primary to-primary-900 dark:from-primary-200 dark:to-primary-600 py-24 px-8 text-center">
        <h1 className="text-6xl font-extrabold mb-4 drop-shadow-md tracking-tight text-primary-50">Echoherence</h1>
        <p className="text-xl max-w-2xl mx-auto mb-8 text-primary-50">
          The ultimate collaborative audio project management system. Share, version, and perfect your audio projects together.
        </p>
        <button 
          onClick={handleLogin}
          className="inline-block bg-background-content text-primary px-8 py-4 rounded-lg font-semibold transition transform hover:-translate-y-0.5"
        >
          Start Collaborating
        </button>
      </section>

      <section className="max-w-7xl mx-auto px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mt-12">
          <Card>
            <CardHeader>Seamless Collaboration</CardHeader>
            <CardBody>
              Work together in real-time with role-based permissions and instant updates. Share projects easily with configurable invite links.
            </CardBody>
          </Card>

          <Card>
            <CardHeader>Version Control</CardHeader>
            <CardBody>
              Keep track of every change with comprehensive version control. Switch between versions instantly while preserving playback position.
            </CardBody>
          </Card>

          <Card>
            <CardHeader>Advanced Audio Player</CardHeader>
            <CardBody>
              Experience smooth playback with background pre-caching and intelligent browser caching for optimal performance.
            </CardBody>
          </Card>

          <Card>
            <CardHeader>Interactive Comments</CardHeader>
            <CardBody>
              Discuss and refine your projects with thread-based comments. Track resolution status and receive real-time updates.
            </CardBody>
          </Card>
        </div>
      </section>
    </div>
  );
};

export default LandingPage; 
