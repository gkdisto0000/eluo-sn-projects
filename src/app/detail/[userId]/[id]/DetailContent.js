'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/app/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/context/ThemeContext'
import { Header } from '@/components/Header'
import { 
  getFirestore, 
  doc, 
  getDoc, 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot,
  serverTimestamp,
  deleteDoc,
  updateDoc,
  getDocs
} from 'firebase/firestore'

// 댓글 컴포넌트
const Comment = ({ comment, currentUser, onDelete }) => {
  const isAuthor = currentUser?.uid === comment.userId

  return (
    <div className="border-b border-gray-200 dark:border-gray-700 py-4">
      <div className="flex justify-between items-start mb-2">
        <div>
          <span className="font-medium text-gray-900 dark:text-white">
            {comment.userName}
          </span>
          <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
            {comment.createdAt?.toDate().toLocaleString()}
          </span>
        </div>
        {isAuthor && (
          <button
            onClick={() => onDelete(comment.id)}
            className="text-sm text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
          >
            삭제
          </button>
        )}
      </div>
      <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
        {comment.content}
      </p>
    </div>
  )
}

// 날짜 변환 함수 추가
const formatDate = (timestamp) => {
  if (!timestamp) return '';
  if (timestamp instanceof Date) {
    return timestamp.toISOString().split('T')[0];
  }
  if (timestamp.toDate) {
    return timestamp.toDate().toISOString().split('T')[0];
  }
  return '';
};

export default function DetailContent({ userId, projectId }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const { darkMode } = useTheme()
  const [project, setProject] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedProject, setEditedProject] = useState(null)

  // 관리자 상태 체크
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) return
      
      try {
        const db = getFirestore()
        const userDoc = await getDoc(doc(db, 'users', user.uid))
        
        if (userDoc.exists() && userDoc.data().role === 'admin') {
          setIsAdmin(true)
        }
      } catch (error) {
        console.error('관리자 권한 확인 중 오류:', error)
      }
    }

    checkAdminStatus()
  }, [user])

  // 프로젝트 상세 정보 가져오기
  useEffect(() => {
    const fetchProjectDetail = async () => {
      if (!user) return;
      
      try {
        const db = getFirestore();
        const projectRef = doc(db, 'projects', userId, 'userProjects', projectId);
        const projectSnap = await getDoc(projectRef);

        if (projectSnap.exists()) {
          const data = projectSnap.data();
          const totalEffort = 
            Number(data.planning?.effort || 0) +
            Number(data.design?.effort || 0) +
            Number(data.publishing?.effort || 0) +
            Number(data.development?.effort || 0);

          const projectData = {
            id: projectId,
            ownerId: userId,
            title: data.title || '',
            status: data.status || '대기',
            totalEffort: totalEffort > 0 ? Number(totalEffort.toFixed(1)) : null,
            requestDate: data.requestDate || null,
            startDate: data.startDate || null,
            endDate: data.endDate || null,
            description: data.description || '',
            planning: {
              name: data.planning?.name || '',
              effort: data.planning?.effort || null
            },
            design: {
              name: data.design?.name || '',
              effort: data.design?.effort || null
            },
            publishing: {
              name: data.publishing?.name || '',
              effort: data.publishing?.effort || null
            },
            development: {
              name: data.development?.name || '',
              effort: data.development?.effort || null
            },
            createAt: data.createAt || null,
            updateAt: data.updateAt || null
          };

          setProject(projectData);
          setEditedProject(projectData);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('프로젝트 정보 가져오기 오류:', error);
        setError('프로젝트 정보를 가져오는데 실패했습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    if (!loading) {
      if (!user) {
        router.push('/');
      } else {
        fetchProjectDetail();
      }
    }
  }, [user, loading, userId, projectId, router]);

  // 댓글 가져오기
  useEffect(() => {
    if (!user || !projectId) return;

    const db = getFirestore();
    const commentsRef = collection(db, 'projects', userId, 'userProjects', projectId, 'comments');
    const q = query(commentsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const commentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setComments(commentsData);
    });

    return () => unsubscribe();
  }, [user, userId, projectId]);

  // 댓글 추가
  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const db = getFirestore();
      const commentsRef = collection(db, 'projects', userId, 'userProjects', projectId, 'comments');
      
      await addDoc(commentsRef, {
        content: newComment,
        userId: user.uid,
        userName: user.email,
        createdAt: serverTimestamp()
      });

      setNewComment('');
    } catch (error) {
      console.error('댓글 작성 중 오류:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 댓글 삭제
  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('댓��을 삭제하시겠습니까?')) return;

    try {
      const db = getFirestore();
      const commentRef = doc(db, 'projects', userId, 'userProjects', projectId, 'comments', commentId);
      await deleteDoc(commentRef);
    } catch (error) {
      console.error('댓글 삭제 중 오류:', error);
    }
  };

  // 프로젝트 삭제
  const handleDelete = async () => {
    if (!window.confirm('프로젝트를 삭제하시겠습니까?')) return;

    try {
      const db = getFirestore();
      const projectRef = doc(db, 'projects', userId, 'userProjects', projectId);
      await deleteDoc(projectRef);
      router.push('/main');
    } catch (error) {
      console.error('프로젝트 삭제 중 오류:', error);
    }
  };

  // 프로젝트 수정
  const handleSave = async () => {
    if (!editedProject) return;

    try {
      const db = getFirestore();
      const projectRef = doc(db, 'projects', userId, 'userProjects', projectId);
      
      await updateDoc(projectRef, {
        ...editedProject,
        updateAt: serverTimestamp()
      });

      setProject(editedProject);
      setIsEditing(false);
    } catch (error) {
      console.error('프로젝트 수정 중 오류:', error);
    }
  };

  if (isLoading) {
    return <div>로딩 중...</div>;
  }

  if (error) {
    return <div>에��: {error}</div>;
  }

  if (!project) {
    return <div>프로젝트를 찾을 수 없습니다.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 메인 컨텐츠 카드 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
          {/* 프로젝트 헤더 */}
          <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-800 dark:to-purple-800">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-white">
                {isEditing ? (
                  <input
                    type="text"
                    value={editedProject.title}
                    onChange={(e) => setEditedProject({...editedProject, title: e.target.value})}
                    className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 
                      text-white placeholder-white/60 focus:ring-2 focus:ring-white/50"
                    placeholder="프로젝트 제목"
                  />
                ) : (
                  project.title
                )}
              </h1>
              <div className={`px-4 py-1.5 rounded-full text-sm font-medium
                ${project.status === '진행' 
                  ? 'bg-green-100 text-green-800' 
                  : project.status === '대기' 
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-red-100 text-red-800'}`}
              >
                {project.status}
              </div>
            </div>
          </div>

          <div className="p-6 space-y-8">
            {/* 날짜 및 공수 정보 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">현업요청일</div>
                {isEditing ? (
                  <input
                    type="date"
                    value={formatDate(editedProject.requestDate)}
                    onChange={(e) => setEditedProject({...editedProject, requestDate: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-700 
                      border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                  />
                ) : (
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    {formatDate(project.requestDate)}
                  </div>
                )}
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">시작일</div>
                {isEditing ? (
                  <input
                    type="date"
                    value={formatDate(editedProject.startDate)}
                    onChange={(e) => setEditedProject({...editedProject, startDate: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-700 
                      border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                  />
                ) : (
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    {formatDate(project.startDate)}
                  </div>
                )}
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">종료일</div>
                {isEditing ? (
                  <input
                    type="date"
                    value={formatDate(editedProject.endDate)}
                    onChange={(e) => setEditedProject({...editedProject, endDate: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-700 
                      border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                  />
                ) : (
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    {formatDate(project.endDate)}
                  </div>
                )}
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">총 공수</div>
                <div className="text-lg font-semibold text-gray-900 dark:text-white">
                  {project.totalEffort}MD
                </div>
              </div>
            </div>

            {/* 담당자 정보 - 전체 너비로 변경 */}
            <div className="w-full bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">담당자 정보</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 기획 */}
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                    기획
                  </label>
                  {isEditing ? (
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={editedProject.planning.name}
                        onChange={(e) => setEditedProject({
                          ...editedProject,
                          planning: { ...editedProject.planning, name: e.target.value }
                        })}
                        className="flex-1 px-4 py-2 rounded-lg bg-white dark:bg-gray-700 
                          border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                        placeholder="담당자 이름"
                      />
                      <input
                        type="text"
                        value={editedProject.planning.effort ?? ''}
                        onChange={(e) => setEditedProject({
                          ...editedProject,
                          planning: { ...editedProject.planning, effort: e.target.value }
                        })}
                        className="w-28 px-4 py-2 rounded-lg bg-white dark:bg-gray-700 
                          border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                        placeholder="공수(MD)"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <span className="text-blue-600 dark:text-blue-400 font-medium">
                        {project.planning.name}
                      </span>
                      {project.planning.effort !== null && (
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          ({project.planning.effort}MD)
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {/* 디자인 */}
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                    디자인
                  </label>
                  {isEditing ? (
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={editedProject.design.name}
                        onChange={(e) => setEditedProject({
                          ...editedProject,
                          design: { ...editedProject.design, name: e.target.value }
                        })}
                        className="flex-1 px-4 py-2 rounded-lg bg-white dark:bg-gray-700 
                          border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                        placeholder="담당자 이름"
                      />
                      <input
                        type="text"
                        value={editedProject.design.effort ?? ''}
                        onChange={(e) => setEditedProject({
                          ...editedProject,
                          design: { ...editedProject.design, effort: e.target.value }
                        })}
                        className="w-28 px-4 py-2 rounded-lg bg-white dark:bg-gray-700 
                          border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                        placeholder="공수(MD)"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <span className="text-purple-600 dark:text-purple-400 font-medium">
                        {project.design.name}
                      </span>
                      {project.design.effort !== null && (
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          ({project.design.effort}MD)
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {/* 퍼블리싱 */}
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                    퍼블리싱
                  </label>
                  {isEditing ? (
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={editedProject.publishing.name}
                        onChange={(e) => setEditedProject({
                          ...editedProject,
                          publishing: { ...editedProject.publishing, name: e.target.value }
                        })}
                        className="flex-1 px-4 py-2 rounded-lg bg-white dark:bg-gray-700 
                          border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                        placeholder="담당자 이름"
                      />
                      <input
                        type="text"
                        value={editedProject.publishing.effort ?? ''}
                        onChange={(e) => setEditedProject({
                          ...editedProject,
                          publishing: { ...editedProject.publishing, effort: e.target.value }
                        })}
                        className="w-28 px-4 py-2 rounded-lg bg-white dark:bg-gray-700 
                          border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                        placeholder="공수(MD)"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <span className="text-green-600 dark:text-green-400 font-medium">
                        {project.publishing.name}
                      </span>
                      {project.publishing.effort !== null && (
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          ({project.publishing.effort}MD)
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {/* 개발 */}
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                    개발
                  </label>
                  {isEditing ? (
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={editedProject.development.name}
                        onChange={(e) => setEditedProject({
                          ...editedProject,
                          development: { ...editedProject.development, name: e.target.value }
                        })}
                        className="flex-1 px-4 py-2 rounded-lg bg-white dark:bg-gray-700 
                          border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                        placeholder="담당자 이름"
                      />
                      <input
                        type="text"
                        value={editedProject.development.effort ?? ''}
                        onChange={(e) => setEditedProject({
                          ...editedProject,
                          development: { ...editedProject.development, effort: e.target.value }
                        })}
                        className="w-28 px-4 py-2 rounded-lg bg-white dark:bg-gray-700 
                          border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                        placeholder="공수(MD)"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <span className="text-orange-600 dark:text-orange-400 font-medium">
                        {project.development.name}
                      </span>
                      {project.development.effort !== null && (
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          ({project.development.effort}MD)
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 프로젝트 설명 - 아래로 이동 */}
            <div className="w-full bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">프로젝트 설명</h3>
              {isEditing ? (
                <textarea
                  value={editedProject.description}
                  onChange={(e) => setEditedProject({...editedProject, description: e.target.value})}
                  className="w-full px-4 py-3 rounded-lg bg-white dark:bg-gray-700 
                    border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                  rows="8"
                  placeholder="프로젝트 설명을 입력하세요"
                />
              ) : (
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {project.description}
                </p>
              )}
            </div>

            {/* 댓글 섹션 */}
            {!isEditing && (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">댓글</h3>
                
                <form onSubmit={handleAddComment} className="mb-6">
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="댓글을 입력하세요"
                      className="flex-1 px-4 py-2 rounded-lg bg-white dark:bg-gray-700 
                        border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                    />
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 
                        transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                        disabled:bg-blue-300 disabled:cursor-not-allowed"
                    >
                      작성
                    </button>
                  </div>
                </form>

                <div className="space-y-4">
                  {comments.map(comment => (
                    <Comment
                      key={comment.id}
                      comment={comment}
                      currentUser={user}
                      onDelete={handleDeleteComment}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 버튼 영역 */}
            <div className="flex justify-end gap-3">
              {isEditing ? (
                <>
                  <button
                    onClick={handleSave}
                    className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 
                      transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    저장
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false)
                      setEditedProject(project)
                    }}
                    className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 
                      transition-colors focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                  >
                    취소
                  </button>
                </>
              ) : (
                <>
                  {isAdmin && (
                    <>
                      <button
                        onClick={() => setIsEditing(true)}
                        className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 
                          transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      >
                        수정
                      </button>
                      <button
                        onClick={handleDelete}
                        className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 
                          transition-colors focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                      >
                        삭제
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => router.push('/main')}
                    className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 
                      transition-colors focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                  >
                    목록으로
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}