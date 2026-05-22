import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center" style={{ animation: 'fadeSlideUp 0.6s cubic-bezier(0.16,1,0.3,1) both' }}>
        <h1 className="mb-4 text-4xl font-bold" style={{ animation: 'scaleIn 0.5s cubic-bezier(0.16,1,0.3,1) both' }}>404</h1>
        <p className="mb-4 text-xl text-muted-foreground" style={{ animation: 'fadeIn 0.5s ease-out both', animationDelay: '0.15s' }}>Oops! Page not found</p>
        <a href="/" className="text-primary underline hover:text-primary/90" style={{ animation: 'fadeIn 0.5s ease-out both', animationDelay: '0.25s' }}>
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;