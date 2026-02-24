'use client'

import { useState } from 'react'
import CreateEmployeeModal from './CreateEmployeeModal'
import { useToast } from '@/components/ToastProvider'

interface CreateEmployeeButtonProps {
  onCreated?: () => void;
}

export default function CreateEmployeeButton({ onCreated }: CreateEmployeeButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const toast = useToast()

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
      >
        <svg
          className="-ml-1 mr-2 h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
        Add Employee
      </button>

      {isModalOpen && (
        <CreateEmployeeModal
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            setIsModalOpen(false)
            toast.success('Employee created successfully')
            onCreated?.()
          }}
        />
      )}
    </>
  )
}
