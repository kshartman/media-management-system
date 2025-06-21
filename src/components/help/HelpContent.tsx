'use client';

import { useAuth } from '@/lib/authContext';
import { useState } from 'react';

interface HelpSection {
  id: string;
  title: string;
  content: React.ReactNode;
  roles: string[];
}

export default function HelpContent() {
  const { isAuthenticated, isAdmin } = useAuth();
  const [activeSection, setActiveSection] = useState('getting-started');

  const helpSections: HelpSection[] = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      roles: ['anonymous', 'user', 'admin'],
      content: (
        <div className="space-y-4">
          <p>Welcome to the Media Management System! This platform helps you browse, search, and download marketing media content.</p>
          
          <h3 className="text-lg font-semibold">What You Can Do:</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Browse Media:</strong> View all available images, social posts, and video content</li>
            <li><strong>Search & Filter:</strong> Find specific content using search terms, tags, or media types</li>
            <li><strong>Download Content:</strong> Download individual files or complete packages</li>
            <li><strong>Preview Content:</strong> Click on any card to see full details and larger previews</li>
          </ul>

          <h3 className="text-lg font-semibold">Media Types:</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <a href="/images" className="p-3 border rounded hover:bg-gray-50 transition-colors block">
              <h4 className="font-medium text-blue-600">Image Cards</h4>
              <p className="text-sm text-gray-600">High-quality images with downloadable versions</p>
            </a>
            <a href="/posts" className="p-3 border rounded hover:bg-gray-50 transition-colors block">
              <h4 className="font-medium text-green-600">Social Cards</h4>
              <p className="text-sm text-gray-600">Image sequences with social media copy for Instagram/Facebook</p>
            </a>
            <a href="/reels" className="p-3 border rounded hover:bg-gray-50 transition-colors block">
              <h4 className="font-medium text-purple-600">Reel Cards</h4>
              <p className="text-sm text-gray-600">Video content with transcripts and social copy</p>
            </a>
          </div>
        </div>
      )
    },
    {
      id: 'browsing-downloading',
      title: 'Browsing & Downloading',
      roles: ['anonymous', 'user', 'admin'],
      content: (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Finding Content</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Search Bar:</strong> Type keywords to find specific content</li>
            <li><strong>Type Filter:</strong> Filter by Image, Social, or Reel cards</li>
            <li><strong>Tag Filter:</strong> Select specific tags to narrow results</li>
            <li><strong>Sort Options:</strong> Sort by newest, oldest, or alphabetically</li>
          </ul>

          <h3 className="text-lg font-semibold">Downloading Content</h3>
          <div className="space-y-3">
            <div className="p-3 bg-blue-50 rounded">
              <h4 className="font-medium">Single File Download</h4>
              <p className="text-sm">
                Click the download button (
                <span className="inline-flex items-center text-blue-600">
                  <svg className="h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </span>
                ) on Reel and Image cards to get the main file
              </p>
            </div>
            <div className="p-3 bg-green-50 rounded">
              <h4 className="font-medium">Download ZIP</h4>
              <p className="text-sm">
                Use the Download ZIP button (
                <span className="inline-flex items-center text-blue-600">
                  <svg className="h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span className="font-medium">ZIP</span>
                </span>
                ) to get all related files bundled together in a ZIP file. This includes images, social media copy, transcripts, and any other associated files.
              </p>
            </div>
          </div>

          <h3 className="text-lg font-semibold">Viewing Content</h3>
          <p>Tap the card to preview the main content (larger images/videos).</p>
          
          <p className="mt-3">Use the icons at the bottom of each card to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Read full social media copy</li>
            <li>View video transcripts (for Reel cards)</li>
            <li>Access all download options</li>
          </ul>

        </div>
      )
    }
  ];

  if (isAuthenticated) {
    helpSections.push({
      id: 'managing-content',
      title: 'Managing Content',
      roles: ['user', 'admin'],
      content: (
        <div className="space-y-4">
          <p>As a logged-in user, you can create, edit, and manage media content.</p>

          <h3 className="text-lg font-semibold">Creating New Cards</h3>
          <ol className="list-decimal pl-6 space-y-2">
            <li>
              Click the 
              <span className="inline-flex items-center mx-1 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded">
                + Card
              </span>
              button
            </li>
            <li>Choose your card type (Image, Social, or Reel)</li>
            <li>Upload your media files</li>
            <li>Add a title and description</li>
            <li>Select relevant tags</li>
            <li>Add social copy (for Social and Reel cards)</li>
            <li>Save your card</li>
          </ol>

          <h3 className="text-lg font-semibold">Editing Existing Cards</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              Click the edit icon (
              <svg className="inline h-4 w-4 mx-1 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              ) on any card
            </li>
            <li>Modify any field including files, title, description, or tags</li>
            <li>Update social copy using the rich text editor</li>
            <li>Save changes when complete</li>
          </ul>

          <h3 className="text-lg font-semibold">File Upload Tips</h3>
          <div className="space-y-2">
            <div className="p-3 bg-yellow-50 rounded">
              <h4 className="font-medium">Image Cards</h4>
              <p className="text-sm">Upload high-resolution images. PNG and JPG formats recommended.</p>
            </div>
            <div className="p-3 bg-blue-50 rounded">
              <h4 className="font-medium">Social Cards</h4>
              <p className="text-sm">Upload multiple images for carousel posts. Add engaging copy for each platform.</p>
            </div>
            <div className="p-3 bg-purple-50 rounded">
              <h4 className="font-medium">Reel Cards</h4>
              <p className="text-sm">Upload MP4 videos. Include transcripts and hashtag-optimized copy.</p>
            </div>
          </div>

          <h3 className="text-lg font-semibold">Deleting & Trash Management</h3>
          <div className="space-y-3">
            <div className="p-3 bg-orange-50 rounded">
              <h4 className="font-medium">Soft Delete (Move to Trash)</h4>
              <p className="text-sm">
                Click the delete icon (
                <svg className="inline h-4 w-4 mx-1 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                ) to move cards to trash. Deleted cards are hidden but can be restored.
              </p>
            </div>
            <div className="p-3 bg-blue-50 rounded">
              <h4 className="font-medium">Viewing Trash</h4>
              <p className="text-sm">
                Toggle &quot;Show Deleted&quot; / &quot;Hide Deleted&quot; in the hamburger menu (☰) to show/hide deleted cards. Deleted cards appear with a gray overlay.
              </p>
            </div>
            <div className="p-3 bg-green-50 rounded">
              <h4 className="font-medium">Restoring Cards</h4>
              <p className="text-sm">
                For deleted cards, click the &quot;Restore&quot; button to restore them back to active status.
              </p>
            </div>
            <div className="p-3 bg-red-50 rounded">
              <h4 className="font-medium">Permanent Deletion</h4>
              <p className="text-sm">
                Admin users can permanently delete cards that are already in trash. This action cannot be undone!
                Cards are also automatically deleted after 30 days in trash.
              </p>
            </div>
          </div>
        </div>
      )
    });
  }

  if (isAdmin) {
    helpSections.push({
      id: 'admin-features',
      title: 'Admin Features',
      roles: ['admin'],
      content: (
        <div className="space-y-4">
          <p>As an administrator, you have additional user management capabilities.</p>

          <h3 className="text-lg font-semibold">User Management</h3>
          <p>Access the Admin panel to manage users:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>View Users:</strong> See all registered users and their roles</li>
            <li><strong>Create Users:</strong> Add new user accounts with email invitations</li>
            <li><strong>Edit Users:</strong> Update usernames, emails, and roles</li>
            <li><strong>Delete Users:</strong> Remove user accounts (cannot delete the last admin)</li>
          </ul>

          <h3 className="text-lg font-semibold">User Roles</h3>
          <div className="space-y-3">
            <div className="p-3 bg-blue-50 rounded">
              <h4 className="font-medium">Editor Role</h4>
              <p className="text-sm">Can create, edit, and delete media cards. Can view and restore deleted cards. Default role for new accounts.</p>
            </div>
            <div className="p-3 bg-red-50 rounded">
              <h4 className="font-medium">Admin Role</h4>
              <p className="text-sm">Full access including user management and permanent card deletion. Use carefully!</p>
            </div>
          </div>

          <h3 className="text-lg font-semibold">Creating New Users</h3>
          <ol className="list-decimal pl-6 space-y-2">
            <li>
              Click the 
              <span className="inline-flex items-center mx-1 px-3 py-1.5 bg-purple-600 text-white text-sm font-medium rounded">
                <svg className="h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zm8 0a3 3 0 11-6 0 3 3 0 016 0zm-4.07 11c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                </svg>
                Users
              </span>
              button
            </li>
            <li>Click &quot;Add New User&quot;</li>
            <li>Enter username and email</li>
            <li>Set initial password</li>
            <li>Choose role (Editor or Admin)</li>
            <li>Save - the user will receive a welcome email</li>
          </ol>

          <h3 className="text-lg font-semibold">Trash Management (Admin Only)</h3>
          <div className="space-y-3">
            <div className="p-3 bg-orange-50 rounded">
              <h4 className="font-medium">Permanent Deletion</h4>
              <p className="text-sm">
                Admin users can permanently delete cards that are already in trash. When viewing deleted cards 
                (using the trash toggle), clicking delete on a card that&apos;s already deleted will permanently 
                remove it and all associated files.
              </p>
            </div>
            <div className="p-3 bg-blue-50 rounded">
              <h4 className="font-medium">Automatic Cleanup</h4>
              <p className="text-sm">
                Cards in trash are automatically cleaned up after 30 days. The system runs this cleanup 
                daily at startup to remove old deleted content.
              </p>
            </div>
          </div>

          <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400">
            <h4 className="font-medium">⚠️ Admin Best Practices</h4>
            <ul className="text-sm mt-2 space-y-1">
              <li>• Always maintain at least one admin account</li>
              <li>• Only grant admin access when necessary</li>
              <li>• Use strong passwords for admin accounts</li>
              <li>• Regularly review user accounts and permissions</li>
              <li>• Be careful with permanent deletions - they cannot be undone</li>
            </ul>
          </div>
        </div>
      )
    });
  }

  const availableSections = helpSections.filter(section => 
    section.roles.includes('anonymous') || 
    (isAuthenticated && section.roles.includes('user')) ||
    (isAdmin && section.roles.includes('admin'))
  );

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Help</h1>
        <p className="text-gray-600">
          Learn how to use the Media Management System effectively
          {isAuthenticated && (
            <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
              Logged in as {isAdmin ? 'Admin' : 'Editor'}
            </span>
          )}
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <nav className="lg:w-64 flex-shrink-0">
          <div className="bg-white rounded-lg shadow p-4 sticky top-6">
            <h2 className="font-semibold text-gray-900 mb-3">Contents</h2>
            <ul className="space-y-2">
              {availableSections.map((section) => (
                <li key={section.id}>
                  <button
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                      activeSection === section.id
                        ? 'bg-blue-100 text-blue-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    {section.title}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <main className="flex-1">
          <div className="bg-white rounded-lg shadow p-6">
            {availableSections.map((section) => (
              <div
                key={section.id}
                className={activeSection === section.id ? 'block' : 'hidden'}
              >
                <h2 className="text-2xl font-bold text-gray-900 mb-4">{section.title}</h2>
                {section.content}
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}