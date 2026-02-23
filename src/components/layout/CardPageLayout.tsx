'use client';

import React, { useState, useEffect } from 'react';
import TypeDropdown from '../filters/TypeDropdown';
import TagDropdown from '../filters/TagDropdown';
import SortDropdown from '../filters/SortDropdown';
import SearchField from '../filters/SearchField';
import LoginForm from '../auth/LoginForm';
import ForgotPasswordForm from '../auth/ForgotPasswordForm';
import AdminBar from '../admin/AdminBar';
import UserManagement from '../admin/UserManagement';
import CardUploadModal from '../admin/CardUploadModal';
import CardGrid from './CardGrid';
import AppHeader from './AppHeader';
import { CardProps } from '../../types';
import { useAuth } from '../../lib/authContext';
import { useCardManagement } from '../../hooks/useCardManagement';
import { updateCard, createCard } from '../../lib/api';

interface CardPageLayoutProps {
  pageTitle?: string;
  showTypeFilter?: boolean;
  allowedTypes?: string[];
  showControls?: boolean;
}

export default function CardPageLayout({ 
  pageTitle = "Media Library",
  showTypeFilter = true,
  allowedTypes = [],
  showControls = true
}: CardPageLayoutProps) {
  const { isAdmin, isEditor } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [currentEditCard, setCurrentEditCard] = useState<CardProps | undefined>(undefined);

  // Use the shared card management hook
  const cardManagement = useCardManagement({
    defaultTypes: allowedTypes,
    initialSort: 'newest',
    pageSize: 100
  });

  const {
    selectedTypes,
    selectedTags,
    currentSort,
    searchTerm,
    filteredCards,
    availableTags,
    loading,
    lastEditedCardId,
    totalCardCount,
    showDeleted,
    handleFilterChange,
    handleSearch,
    handleSortChange,
    handleEditCard,
    handleDeleteCard,
    handleCardCreated,
    handleCardUpdated,
    loadMore,
    setShowDeleted,
    setLastEditedCardId
  } = cardManagement;

  // Handle opening edit modal
  const handleEditCardWithModal = (cardId: string) => {
    const card = filteredCards.find(c => c.id === cardId);
    if (card?.isDeleted) {
      // For deleted cards, directly restore
      handleEditCard(cardId);
    } else {
      // For normal cards, open edit modal
      setCurrentEditCard(card);
      setShowEditModal(true);
      setLastEditedCardId(cardId);
    }
  };

  // Handle login click
  const handleLoginClick = () => {
    setShowLoginModal(true);
  };

  // Handle user management click
  const handleUserManagementClick = () => {
    setShowUserManagement(true);
  };

  // Handle forgot password
  const handleForgotPassword = () => {
    setShowLoginModal(false);
    setShowForgotPasswordModal(true);
  };

  // Handle back to login
  const handleBackToLogin = () => {
    setShowForgotPasswordModal(false);
    setShowLoginModal(true);
  };

  // Body scroll locking effect for modals
  useEffect(() => {
    if (!showLoginModal && !showForgotPasswordModal) return;

    const originalStyle = window.getComputedStyle(document.body).overflow;
    const scrollY = window.scrollY;
    
    const scrollPosForThisModal = scrollY;
    
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.top = `-${scrollY}px`;
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalStyle;
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
      document.documentElement.style.overflow = '';
      
      window.scrollTo(0, scrollPosForThisModal);
    };
  }, [showLoginModal, showForgotPasswordModal]);

  // Handle Escape key to close modals
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showForgotPasswordModal) {
          setShowForgotPasswordModal(false);
        } else if (showLoginModal) {
          setShowLoginModal(false);
        } else if (showEditModal) {
          setShowEditModal(false);
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showLoginModal, showForgotPasswordModal, showEditModal]);

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader 
        title={pageTitle}
        showControls={showControls}
        onLoginClick={handleLoginClick}
        showDeleted={showDeleted}
        onToggleDeleted={setShowDeleted}
        onUserManagementClick={isAdmin ? handleUserManagementClick : undefined}
        controlsSlot={
          showControls ? (
            <>
              {/* Controls row - keeps all controls on one line */}
              <div className="flex items-center gap-4">
                {isEditor && (
                  <AdminBar 
                    onCardCreated={handleCardCreated}
                    availableTags={availableTags}
                    selectedCardType={allowedTypes.length === 1 ? allowedTypes[0] : undefined}
                    isAdmin={isAdmin}
                  />
                )}
                
                {/* Filter controls */}
                <div className="flex items-center gap-3">
                  {showTypeFilter && (
                    <TypeDropdown
                      onFilterChange={handleFilterChange}
                      selectedTypes={selectedTypes}
                    />
                  )}
                  
                  <div className="hidden sm:block">
                    <TagDropdown
                      selectedTags={selectedTags}
                      onFilterChange={(filters) => handleFilterChange(filters)}
                      availableTags={availableTags}
                    />
                  </div>

                  <SortDropdown
                    currentSort={currentSort}
                    onSortChange={handleSortChange}
                  />
                </div>
                
                {/* Search field - aligned to right */}
                <div className="ml-auto">
                  <SearchField
                    onSearch={handleSearch}
                    initialSearchTerm={searchTerm}
                  />
                </div>
              </div>
            </>
          ) : undefined
        }
      />

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="relative w-full max-w-xl min-w-96">
            <LoginForm 
              onLoginSuccess={() => setShowLoginModal(false)}
              onForgotPassword={handleForgotPassword}
            />
          </div>
        </div>
      )}

      {/* Forgot Password Modal */}
      {showForgotPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="relative">
            <ForgotPasswordForm 
              onBackToLogin={handleBackToLogin}
            />
          </div>
        </div>
      )}

      {/* Edit/Upload Modal */}
      {showEditModal && (
        <CardUploadModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setCurrentEditCard(undefined);
          }}
          onSubmit={currentEditCard ? 
            async (formData: FormData) => { 
              await updateCard(currentEditCard.id, formData);
              await handleCardUpdated();
              setShowEditModal(false);
              setCurrentEditCard(undefined);
            } : 
            async (formData: FormData) => { 
              await createCard(formData);
              await handleCardCreated();
              setShowEditModal(false);
            }
          }
          initialData={currentEditCard}
          availableTags={availableTags}
        />
      )}

      {/* User Management Modal */}
      {showUserManagement && (
        <UserManagement
          isOpen={showUserManagement}
          onClose={() => setShowUserManagement(false)}
        />
      )}

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Results count */}
        <div className="mb-6">
          <p className="text-sm text-gray-600">
            Showing {filteredCards.length} of {totalCardCount} {allowedTypes.length === 1 ? allowedTypes[0] : 'card'}
            {totalCardCount !== 1 ? 's' : ''}
            {searchTerm && ` matching "${searchTerm}"`}
            {selectedTags.length > 0 && ` tagged with ${selectedTags.join(', ')}`}
            {showDeleted && ' (including deleted)'}
          </p>
        </div>

        {/* Card Grid */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <CardGrid
            initialCards={filteredCards}
            loadMore={loadMore}
            isAdmin={isAdmin}
            isEditor={isEditor}
            onEdit={isEditor ? handleEditCardWithModal : undefined}
            onDelete={isEditor ? handleDeleteCard : undefined}
            selectedTypes={selectedTypes}
            lastEditedCardId={lastEditedCardId}
          />
        )}
      </main>
    </div>
  );
}