'use client';
import React from 'react';
import MemoriesView from '@/app/components/MemoriesView';
import { useSearchParams } from 'next/navigation';

const SingleListViewPage = () => {
  const searchParams = useSearchParams();
  const singleListView = searchParams.get('listId');

  return <MemoriesView singleListView={singleListView} />;
};

export default SingleListViewPage;
