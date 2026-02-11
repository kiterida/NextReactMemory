// src/memoryData.js
import { supabase } from './supabaseClient';

export const searchMemoryItems = async (searchString) => {
  const { data, error } = await supabase
    .from('memory_items')
    .select('*')
    .or(
      `name.ilike.%${searchString}%,description.ilike.%${searchString}%,code_snippet.ilike.%${searchString}%`
    );

  if (error) {
    console.error("Error fetching memory items:", error);
    return [];
  }

  return data;
};



// Fetch memory tree data from Supabase, order it by integer memory_key, and structure it as a nested tree
export const fetchMemoryTree = async () => {

  const { data, error } = await supabase
    .from('memory_tree_with_starred')
    .select('*')
    .range(0, 9999); // Can now exceed 1000 safely

  if (error) {
    console.error("Error fetching memory tree view:", error);
    return [];
  }

  console.log("fetchMemoryTree data length = ", data.length);

  // Sort data with null parent_id items first, ordered by integer memory_key
  data.sort((a, b) => {
    if (a.parent_id === null && b.parent_id !== null) return -1;
    if (a.parent_id !== null && b.parent_id === null) return 1;
    if (a.parent_id === b.parent_id) {
      // Convert memory_key to integer for comparison
      return parseInt(a.memory_key, 10) - parseInt(b.memory_key, 10);
    }
    return 0;
  });

  const dataMap = {};
  data.forEach((item) => {
    dataMap[item.id] = { ...item, children: [] };
  });

  //console.log("dataMap = ", dataMap);

  const nestedData = [];
  data.forEach((item) => {
    if (item.parent_id === null) {
      nestedData.push(dataMap[item.id]);
    } else if (dataMap[item.parent_id]) {
      dataMap[item.parent_id].children.push(dataMap[item.id]);
    }
  });

  //console.log("nestedData = ", nestedData);

  return nestedData;
};

// // Fetch memory tree data from Supabase, order it, and structure it as a nested tree
// export const fetchMemoryTree = async () => {
//     const { data, error } = await supabase.rpc('fetch_memory_tree');
//     if (error) {
//       console.error("Error fetching memory tree:", error);
//       return [];
//     }

//     // Sort data with null parent_id items first, ordered by memory_key
//     data.sort((a, b) => {
//       if (a.parent_id === null && b.parent_id !== null) return -1;
//       if (a.parent_id !== null && b.parent_id === null) return 1;
//       if (a.parent_id === b.parent_id) {
//         return a.memory_key.localeCompare(b.memory_key);
//       }
//       return 0;
//     });

//     const dataMap = {};
//     data.forEach((item) => {
//       dataMap[item.id] = { ...item, children: [] };
//     });

//     const nestedData = [];
//     data.forEach((item) => {
//       if (item.parent_id === null) {
//         nestedData.push(dataMap[item.id]);
//       } else if (dataMap[item.parent_id]) {
//         dataMap[item.parent_id].children.push(dataMap[item.id]);
//       }
//     });

//     return nestedData;
//   };


// Fetch memory tree data from Supabase and structure it as a nested tree
export const fetchMemoryTreeOriginal = async () => {
  const { data, error } = await supabase.rpc('fetch_memory_tree');
  if (error) {
    console.error("Error fetching memory tree:", error);
    return [];
  }

  const dataMap = {};
  data.forEach((item) => {
    dataMap[item.id] = { ...item, children: [] };
  });

  const nestedData = [];
  data.forEach((item) => {
    if (item.parent_id === null) {
      nestedData.push(dataMap[item.id]);
    } else if (dataMap[item.parent_id]) {
      dataMap[item.parent_id].children.push(dataMap[item.id]);
    }
  });

  return nestedData;
};

// Update the starred status of an item
export const updateStarred = async (memoryId, starredStatus) => {
  console.log("updateStarred", memoryId, starredStatus)

  try {
    const { error } = await supabase
      .from('memory_items')
      .update({ starred: starredStatus })
      .eq('id', memoryId);

    if (error) throw error;
  } catch (err) {
    console.log("Error updating starred item");
  }
}

export const updateMemoryItemParent = async (draggedItemIds, newParentId) => {
  try {
    // Normalize to array
    const ids = Array.isArray(draggedItemIds) ? draggedItemIds : [draggedItemIds];

    if (ids.includes(newParentId)) {
      console.error("Cannot drop an item onto itself.");
      return;
    }

    console.log("Updating parent_id =", newParentId, "for ids =", ids);

    const { error } = await supabase
      .from('memory_items')
      .update({ parent_id: newParentId })
      .in('id', ids); // Bulk update with .in()

    if (error) throw error;
  } catch (err) {
    console.error("Error updating memory item(s):", err);
  }
};


// // Update the parent_id of a memory item (drag and drop logic)
// export const updateMemoryItemParent = async (draggedItemId, newParentId) => {
//   try {
//     if (draggedItemId === newParentId) {
//       console.error("Cannot drop an item onto itself.");
//       return;
//     }

//     console.log("update parent id = ", newParentId, " where id = ", draggedItemId);
//     const { error } = await supabase
//       .from('memory_items')
//       .update({ parent_id: newParentId })
//       .eq('id', draggedItemId);

//     if (error) throw error;
//   } catch (err) {
//     console.error("Error updating memory item:", err);
//   }
// };

// Update a memory item in Supabase (for the edit form)
export const updateMemoryItem = async (id, memory_key, name, memory_image, code_snippet, description) => {
  const { error } = await supabase
    .from('memory_items')
    .update({ memory_key, name, memory_image, code_snippet, description })
    .eq('id', id);

  if (error) {
    console.error("Error updating memory item:", error);
  } else {
    console.log("Item updated successfully!");
  }
};

export const createNewMemoryList = async () => {
  try {


    let highestMemoryKey = 0;

    // Step 1: Query for the rows where parent_id matches and order by memory_key descending
    const { data: highestMemoryKeyData, error: highestMemoryKeyError } = await supabase
      .from('memory_items')
      .select('memory_key')
      .is('parent_id', null)
      .order('memory_key', { ascending: false })  // Order by memory_key in descending order
      .limit(1);  // Limit to only the row with the highest memory_key


    highestMemoryKey = highestMemoryKeyData && highestMemoryKeyData.length > 0
      ? highestMemoryKeyData[0].memory_key + 1  // Increment the highest key
      : 0;

    console.log("New List Memory Key = ", highestMemoryKey, highestMemoryKeyData)
    if (highestMemoryKeyError) {
      throw new Error("Error fetching highest memory_key: " + highestMemoryKeyError.message);
    }

    const { error, data: newItem } = await supabase
      .from('memory_items')
      .insert([{
        name: 'New Memory List',
        memory_key: highestMemoryKey,  // Use the new memory_key
        memory_image: '',
      }])
      .select() // 👈 This tells Supabase to return the inserted row
      .single();

    console.log('newItem inserted = ', newItem);

    if (error) {
      console.error("Error creating new Memory List:", error);
    } else {
      return newItem.id;
    }

  } catch (err) {
    console.error("Error in createNewMemoryList:", err);
  }
};

export const addToRevisionList = async (memoryListIndex, subListIndex = null, memoryKey = null) => {
  const { data, error } = await supabase
    .from('revision_lists')
    .insert([
      {
        list_index: memoryListIndex,   // required
        sub_list_index: subListIndex,  // optional
        item_memory_key: memoryKey     // optional
      }
    ])
    .select() // return inserted row(s)

  if (error) {
    console.error('Insert error:', error)
    return null
  }

  return data
}

export const deleteRevisionList = async (memoryListIndex, subListIndex = null) => {
  const { data, error } = await supabase
    .from("revision_lists")
    .delete()
    .match({
      list_index: memoryListIndex,
      sub_list_index: subListIndex === null ? -1 : subListIndex,
    });

  if (error) {
    console.error("Error deleting revision list:", error);
    throw error;
  }

  console.log("Deleted rows:", data);
  return data;
}

export const insertMultipleItems = async (parentId, amountOfItems) => {

    if(!parentId)
    {
      alert("Invalid ParentId");
      return;
    }

    try {

      const parentIdValue = parentId === "null" ? null : parentId;
      let highestMemoryKey = 0;
      console.log("insertMultipleItems parentIdValue", parentIdValue)
      console.log("insertMultipleItems parentId", parentId)

       // Step 1: Query for the rows where parent_id matches and order by memory_key descending
      const { data: highestMemoryKeyData, error: highestMemoryKeyError } = await supabase
        .from('memory_items')
        .select('memory_key')
        .eq('parent_id', parentId)  // Filter by parent_id
        //  .filter('memory_key', 'is', null)  // This will filter out null values
        .order('memory_key', { ascending: false })  // Order by memory_key in descending order
        .limit(1);  // Limit to only the row with the highest memory_key

      highestMemoryKey = highestMemoryKeyData && highestMemoryKeyData.length > 0
        ? highestMemoryKeyData[0].memory_key + 1  // Set to 1 if no rows exist
        : 0;

      if (highestMemoryKeyData) {
        console.log('highestMemoryKeyData', highestMemoryKeyData[0])
      }

      if (highestMemoryKeyError) {
        throw new Error("insertMultipleItems - Error fetching highest memory_key: " + highestMemoryKeyError.message);
      }


      // Step 2: Determine the new memory_key value
      const newMemoryKey = highestMemoryKey++; 

      // Step 3: Insert the new child item with the new memory_key

        // New query
        const records = Array.from({ length: amountOfItems }, (_, i) => ({
          name: `New Child Item ${i + 1}`,
          memory_key: newMemoryKey + i,  // 👈 incrementing
          memory_image: '',
          parent_id: parentId,
        }));

        const { data, error } = await supabase
          .from('memory_items')
          .insert(records)
          .select(); // returns all inserted rows

      if (error) {
        console.error("insertMultipleItems - Error creating new child item:", error);
      } else {
        console.log('Inserted:', data);
      }
    } catch (err) {
      console.error("Error in insertMultipleItems:", err);
    }
  };

