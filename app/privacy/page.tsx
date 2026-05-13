import { 
  Shield, 
  Database, 
  Activity, 
  Lock, 
  Share2, 
  Trash2, 
  Bookmark, 
  Cpu, 
  ChevronLeft 
} from "lucide-react"
import Link from "next/link"

export const metadata = {
  title: 'Privacy Policy | WorkStack',
  description: 'Learn how WorkStack collects, uses, and protects your data.',
}

export default function PrivacyPolicy() {
  const lastUpdated = "May 13, 2026"

  const sections = [
    {
      id: "data-collection",
      icon: <Database className="w-6 h-6 text-blue-500" />,
      title: "What Data We Collect",
      content: (
        <ul className="space-y-3 text-gray-600 dark:text-gray-300">
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
            <span><strong>Account Information:</strong> Your email address and basic profile details when you sign up.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
            <span><strong>Bookmarking Data:</strong> URLs, page titles, and any custom notes you save to your collections.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
            <span><strong>Tracking Data:</strong> Durations of time spent on specific active tabs, collected via our browser extension.</span>
          </li>
        </ul>
      )
    },
    {
      id: "why-collected",
      icon: <Shield className="w-6 h-6 text-emerald-500" />,
      title: "Why It’s Collected",
      content: (
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          The core purpose of WorkStack is to provide you with a powerful bookmarking, reading list, and productivity tracking experience. 
          We collect this data exclusively to power these features—enabling you to organize collections, monitor your productivity habits, 
          and utilize AI-driven smart search to quickly find saved content. We do not use your data for advertising.
        </p>
      )
    },
    {
      id: "activity-tracking",
      icon: <Activity className="w-6 h-6 text-purple-500" />,
      title: "How Activity Tracking Works",
      content: (
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          If you install the WorkStack browser extension, it monitors your active tabs and calculates the duration you spend on them. 
          This data is periodically sent to the WorkStack API and logged securely in our database. The extension only tracks activity 
          when enabled and does not record keystrokes, form submissions, or the internal content of your browsing sessions.
        </p>
      )
    },
    {
      id: "storage-behavior",
      icon: <Bookmark className="w-6 h-6 text-amber-500" />,
      title: "Bookmark & Storage Behavior",
      content: (
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          Your bookmarks, collections, and tracking history are stored in a secure Postgres database. 
          Data is encrypted in transit and at rest. We employ strict access controls so only you can view your private bookmarks. 
          Publicly shared collections are accessible to anyone with the generated link.
        </p>
      )
    },
    {
      id: "authentication",
      icon: <Lock className="w-6 h-6 text-indigo-500" />,
      title: "Authentication Usage",
      content: (
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
          We use highly secure authentication protocols to manage your identity. When you sign in, a secure JWT (JSON Web Token) 
          is generated and stored locally on your device and inside the extension. This token ensures your sessions remain private 
          and authorized without passing passwords through the extension.
        </p>
      )
    },
    {
      id: "third-party",
      icon: <Cpu className="w-6 h-6 text-pink-500" />,
      title: "Third-Party Services",
      content: (
        <div className="space-y-4 text-gray-600 dark:text-gray-300">
          <p>We rely on trusted third-party services to operate WorkStack securely and efficiently:</p>
          <ul className="space-y-3 pl-2">
            <li className="flex items-start gap-2">
              <strong className="text-gray-900 dark:text-white">Supabase:</strong> 
              <span>Powers our PostgreSQL database and manages secure user authentication.</span>
            </li>
            <li className="flex items-start gap-2">
              <strong className="text-gray-900 dark:text-white">Groq:</strong> 
              <span>Provides lightning-fast AI processing used for our Smart Search and automated tagging capabilities.</span>
            </li>
          </ul>
        </div>
      )
    },
    {
      id: "data-sharing",
      icon: <Share2 className="w-6 h-6 text-orange-500" />,
      title: "Do We Sell or Share Data?",
      content: (
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed font-medium">
          No. We never sell, rent, or trade your personal data, browsing history, or bookmarks to third parties, data brokers, or advertisers. 
          Your data is strictly yours.
        </p>
      )
    },
    {
      id: "deletion-contact",
      icon: <Trash2 className="w-6 h-6 text-red-500" />,
      title: "User Deletion",
      content: (
        <div className="space-y-4 text-gray-600 dark:text-gray-300">
          <p>
            You have full control over your data. You can delete individual bookmarks, wipe your tracking history, or completely delete 
            your account and all associated data at any time from your account settings.
          </p>
        </div>
      )
    }
  ]

  return (
    <div className="min-h-screen relative overflow-hidden bg-white dark:bg-[#0B1120] selection:bg-blue-500/30">
      {/* Decorative Premium Background Elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] opacity-30 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 blur-[100px] rounded-full mix-blend-multiply dark:mix-blend-screen" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-32">
        {/* Header */}
        <div className="mb-16 md:mb-24">
          <Link 
            href="/" 
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors mb-8 group"
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Home
          </Link>
          
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 dark:text-white mb-6">
            Privacy <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-500">Policy</span>
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl">
            We believe your data is yours. Here is a clear, transparent breakdown of how we handle your information to provide the WorkStack experience.
          </p>
          <div className="mt-8 flex items-center gap-2 text-sm text-gray-500">
            <Shield className="w-4 h-4" />
            Last updated: {lastUpdated}
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid gap-8 md:gap-12">
          {sections.map((section, index) => (
            <section 
              key={section.id} 
              className="group relative bg-white/60 dark:bg-gray-900/40 backdrop-blur-xl border border-gray-200/50 dark:border-gray-800/50 rounded-3xl p-6 md:p-8 lg:p-10 shadow-sm hover:shadow-md dark:shadow-none transition-all duration-300"
            >
              <div className="flex items-start gap-4 md:gap-6">
                <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center border border-gray-100 dark:border-gray-700 group-hover:scale-110 transition-transform duration-300">
                  {section.icon}
                </div>
                <div className="flex-1 pt-1">
                  <h2 className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                    {section.title}
                  </h2>
                  <div className="prose prose-gray dark:prose-invert max-w-none">
                    {section.content}
                  </div>
                </div>
              </div>
            </section>
          ))}
        </div>

        {/* Footer Note */}
        <div className="mt-24 text-center">
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            © {new Date().getFullYear()} WorkStack. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  )
}
