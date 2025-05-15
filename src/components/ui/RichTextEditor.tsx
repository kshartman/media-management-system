'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { Color } from '@tiptap/extension-color';
import TextStyle from '@tiptap/extension-text-style';

interface RichTextEditorProps {
  initialContent?: string;
  onChange: (htmlContent: string) => void;
  placeholder?: string;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  initialContent = '',
  onChange,
  placeholder = 'Write something...',
}) => {
  const [isMounted, setIsMounted] = useState(false);

  // Color picker state
  const [showColorPicker, setShowColorPicker] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  
  // Common colors for the color picker
  const commonColors = [
    '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff',
    '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff',
    '#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc',
  ];
  
  // Initialize the editor
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
    ],
    content: initialContent,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-xl focus:outline-none w-full max-w-full p-4 min-h-[300px]',
      },
    },
  });
  
  // Close color picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
        setShowColorPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Set the editor content when initialContent changes
  useEffect(() => {
    if (editor && initialContent && editor.getHTML() !== initialContent) {
      editor.commands.setContent(initialContent);
    }
  }, [editor, initialContent]);

  // Handle client-side rendering
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return (
    <div className="border border-gray-300 rounded-md">
      <div className="border-b border-gray-200 bg-gray-50 p-2 flex gap-2">
        <button
          onClick={() => editor?.chain().focus().toggleBold().run()}
          className={`p-1 rounded ${editor?.isActive('bold') ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
          title="Bold"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" className="w-5 h-5">
            <path fill="none" d="M0 0h24v24H0z" />
            <path d="M8 11h4.5a2.5 2.5 0 1 0 0-5H8v5zm10 4.5a4.5 4.5 0 0 1-4.5 4.5H6V4h6.5a4.5 4.5 0 0 1 3.256 7.636A4.5 4.5 0 0 1 18 15.5zM8 13v5h5.5a2.5 2.5 0 1 0 0-5H8z" fill="currentColor" />
          </svg>
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          className={`p-1 rounded ${editor?.isActive('italic') ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
          title="Italic"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" className="w-5 h-5">
            <path fill="none" d="M0 0h24v24H0z" />
            <path d="M15 20H7v-2h2.927l2.116-12H9V4h8v2h-2.927l-2.116 12H15z" fill="currentColor" />
          </svg>
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
          className={`p-1 rounded ${editor?.isActive('underline') ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
          title="Underline"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" className="w-5 h-5">
            <path fill="none" d="M0 0h24v24H0z" />
            <path d="M8 3v9a4 4 0 1 0 8 0V3h2v9a6 6 0 1 1-12 0V3h2zM4 20h16v2H4v-2z" fill="currentColor" />
          </svg>
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleStrike().run()}
          className={`p-1 rounded ${editor?.isActive('strike') ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
          title="Strikethrough"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" className="w-5 h-5">
            <path fill="none" d="M0 0h24v24H0z" />
            <path d="M17.154 14c.23.516.346 1.09.346 1.72 0 1.342-.524 2.392-1.571 3.147C14.88 19.622 13.433 20 11.586 20c-1.64 0-3.263-.381-4.87-1.144V16.6c1.52.877 3.075 1.316 4.666 1.316 2.551 0 3.83-.732 3.839-2.197a2.21 2.21 0 0 0-.648-1.603l-.12-.117H3v-2h18v2h-3.846zm-4.078-3H7.629a4.086 4.086 0 0 1-.481-.522C6.716 9.92 6.5 9.246 6.5 8.452c0-1.236.466-2.287 1.397-3.153C8.83 4.433 10.271 4 12.222 4c1.471 0 2.879.328 4.222.984v2.152c-1.2-.687-2.515-1.03-3.946-1.03-2.48 0-3.719.782-3.719 2.346 0 .42.218.786.654 1.099.436.313.974.562 1.613.75.62.18 1.297.414 2.03.699z" fill="currentColor" />
          </svg>
        </button>

        <div className="border-r mx-1 border-gray-300"></div>

        <button
          onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`p-1 rounded ${editor?.isActive('heading', { level: 1 }) ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
          title="Heading 1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" className="w-5 h-5">
            <path fill="none" d="M0 0h24v24H0z" />
            <path d="M13 20h-2v-7H4v7H2V4h2v7h7V4h2v16zm8-12v12h-2v-9.796l-2 .536V8.67L19.5 8H21z" fill="currentColor" />
          </svg>
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-1 rounded ${editor?.isActive('heading', { level: 2 }) ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
          title="Heading 2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" className="w-5 h-5">
            <path fill="none" d="M0 0h24v24H0z" />
            <path d="M4 4v7h7V4h2v16h-2v-7H4v7H2V4h2zm14.5 4c2.071 0 3.75 1.679 3.75 3.75 0 .857-.288 1.648-.772 2.28l-.148.18L18.034 18H22v2h-7v-1.556l4.82-5.546c.268-.307.43-.709.43-1.148 0-.966-.784-1.75-1.75-1.75-.918 0-1.671.707-1.744 1.606l-.006.144h-2C14.75 9.679 16.429 8 18.5 8z" fill="currentColor" />
          </svg>
        </button>

        <div className="border-r mx-1 border-gray-300"></div>

        <button
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          className={`p-1 rounded ${editor?.isActive('bulletList') ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
          title="Bullet List"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" className="w-5 h-5">
            <path fill="none" d="M0 0h24v24H0z" />
            <path d="M8 4h13v2H8V4zM4.5 6.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm0 7a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm0 6.9a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zM8 11h13v2H8v-2zm0 7h13v2H8v-2z" fill="currentColor" />
          </svg>
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          className={`p-1 rounded ${editor?.isActive('orderedList') ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
          title="Ordered List"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" className="w-5 h-5">
            <path fill="none" d="M0 0h24v24H0z" />
            <path d="M8 4h13v2H8V4zM5 3v3h1v1H3V6h1V4H3V3h2zm-2 9h3v1h1v-4H6v-1H4v1h1v2H3v1zm2 4v5h1v-1h1v1h1v-1h-1v-1h1v-1h-1v-1h-1v1H5v-1H3v1h2zm6-8h13v2H11v-2zm0 7h13v2H11v-2z" fill="currentColor" />
          </svg>
        </button>
        
        <div className="border-r mx-1 border-gray-300"></div>
        
        {/* Color Picker */}
        <div className="relative" ref={colorPickerRef}>
          <button
            onClick={() => setShowColorPicker(!showColorPicker)}
            className={`p-1 rounded hover:bg-gray-100 flex items-center`}
            title="Text Color"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" className="w-5 h-5">
              <path fill="none" d="M0 0h24v24H0z" />
              <path d="M15.246 14H8.754l-1.6 4H5l6-15h2l6 15h-2.154l-1.6-4zm-.8-2L12 5.885 9.554 12h4.892zM3 20h18v2H3v-2z" fill="currentColor" />
            </svg>
            <span className="w-3 h-3 ml-1 border border-gray-300" style={{ 
              backgroundColor: editor?.getAttributes('textStyle').color || '#000000',
              borderRadius: '2px' 
            }}></span>
          </button>
          
          {showColorPicker && (
            <div className="absolute z-10 mt-1 p-2 bg-white border border-gray-200 rounded shadow-lg">
              <div className="grid grid-cols-10 gap-1 mb-2">
                {commonColors.map((color, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      editor?.chain().focus().setColor(color).run();
                      setShowColorPicker(false);
                    }}
                    className="w-5 h-5 border border-gray-300 rounded hover:scale-110 transition-transform"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
              <div className="mt-2 flex items-center justify-between">
                <button
                  onClick={() => {
                    // Remove color
                    editor?.chain().focus().unsetColor().run();
                    setShowColorPicker(false);
                  }}
                  className="text-xs text-gray-700 hover:text-gray-900"
                >
                  Reset color
                </button>
                <input
                  type="color"
                  onChange={(e) => {
                    editor?.chain().focus().setColor(e.target.value).run();
                  }}
                  className="h-6 w-6"
                  value={editor?.getAttributes('textStyle').color || '#000000'}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <EditorContent editor={editor} className={`${!editor?.getText() && placeholder ? 'relative' : ''}`} />
      
      {!editor?.getText() && placeholder && (
        <div className="absolute top-[calc(2.5rem+0.5rem)] left-4 text-gray-400 pointer-events-none">
          {placeholder}
        </div>
      )}
    </div>
  );
};

export default RichTextEditor;