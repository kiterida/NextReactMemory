'use client';
import React from 'react';
import MemoriesView from '@/app/components/MemoriesView';
import { useSearchParams } from 'next/navigation';

const MemoriesPage = () => {

    const searchParams = useSearchParams();
    const focusId = searchParams.get('focus');

    return (
        <>
        <MemoriesView focusId={focusId} />
        </>
    )
}

export default MemoriesPage;